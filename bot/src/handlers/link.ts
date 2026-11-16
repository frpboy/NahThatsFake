
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { checkCredits, consumeCredit } from '../utils/credits';
import { checkUrlSafety } from '../services/urlscanner';
import { AmbiguousOperationError, ClaimLostError, getNtf, throwIfAborted } from '../errors';
import { markReplyPhase } from '../phases';
import { getOrCreateUserByTelegram, getUserByTelegramId } from '../utils/user';
import { config } from '../config';
import crypto from 'crypto';

export async function processLinkCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  // Webhook delivery context (undefined in long-poll mode: behavior unchanged).
  const ntf = getNtf(ctx.update);
  const updateId = ctx.update?.update_id;

  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || user.id.toString();
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);
  const text = ctx.message?.text;
  
  if (!text) return;

  try {
    const dbUser = actingTelegramUserId === user.id.toString()
      ? await getOrCreateUserByTelegram(user)
      : await getUserByTelegramId(actingTelegramUserId);

    if (!dbUser) {
      await ctx.reply('❌ Target user not found.');
      return;
    }

    // Extract URL from text
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
      await ctx.reply('❌ No valid URL found in your message.');
      return;
    }

    const url = urlMatch[0];
    
    // Check credits
    if (isImpersonating) {
      const credits = await checkCredits(actingTelegramUserId);
      if (!credits.isPremium && credits.dailyRemaining <= 0 && credits.permanentCredits <= 0) {
        await ctx.reply(
`🚫 *No credits left*

⭐ Upgrade to Premium for unlimited access
🎁 Or use /refer to earn credits`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    const creditSourceRaw = isImpersonating ? 'owner' : await consumeCredit(actingTelegramUserId, 'daily', dbUser, ctx.update?.update_id);
    if (!creditSourceRaw) {
      await ctx.reply(
`🚫 *No credits left*

⭐ Upgrade to Premium for unlimited access
🎁 Or use /refer to earn credits`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const creditSource = creditSourceRaw === 'owner' ? 'premium' : creditSourceRaw;

    await ctx.reply('🔍 Analyzing link safety...');

    // Normalize URL for hashing
    const normalizedUrl = normalizeUrl(url);
    // Version the cache key so legacy results created by fail-open provider handling are not reused.
    const urlHash = crypto.createHash('sha256').update(`urlscanner-v2:${normalizedUrl}`).digest('hex');

    // Check cache first. A live 'pending' marker means a previous attempt may
    // still be scanning (or crashed mid-scan): do not start a second scan.
    const { data: cached } = await supabase
      .from('check_cache')
      .select('*')
      .eq('check_type', 'link')
      .eq('content_hash', urlHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (ntf && cached?.scan_status === 'pending') {
      throw new AmbiguousOperationError('previous link scan may still be in flight; not starting another');
    }

    let result;
    if (cached && cached.scan_status !== 'pending') {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        scan_status: 'complete' as const,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      if (ntf) {
        throwIfAborted(ntf);
        // Record the scan phase BEFORE calling providers (same pending-marker
        // contract as image scans; 10-minute pending expiry).
        const pendingExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const { error: pendingError } = await supabase.from('check_cache').insert({
          check_type: 'link',
          content_hash: urlHash,
          score: 0,
          risk_level: 'LOW',
          scan_status: 'pending',
          expires_at: pendingExpiry
        });
        if (pendingError) {
          if ((pendingError as { code?: string }).code === '23505') {
            throw new AmbiguousOperationError('concurrent or uncertain link scan owns the pending marker; not starting another');
          }
          console.error('Link pending-scan claim error:', pendingError);
          throw new AmbiguousOperationError('could not record scan phase; not starting scan');
        }
      }
      throwIfAborted(ntf);
      // Call multiple APIs for link checking
      let apiResult;
      try {
        apiResult = await checkUrlSafety(url);
      } catch (scanError) {
        // Unexpected throw: provider outcomes unknown; the pending marker
        // stays so a later delivery stops instead of starting a second scan.
        if (ntf) {
          throw new AmbiguousOperationError(`link scan outcome uncertain: ${(scanError as Error).message}`);
        }
        throw scanError;
      }
      throwIfAborted(ntf);

      result = {
        score: apiResult.score,
        risk_level: apiResult.risk_level,
        scan_status: apiResult.scan_status,
        cached: false,
        api_source: apiResult.sources.join(', ') || 'unknown'
      };

      if (ntf) {
        if (apiResult.scan_status === 'complete') {
          // Flip the pending marker to a completed 7-day cache entry.
          await supabase.from('check_cache').upsert({
            check_type: 'link',
            content_hash: urlHash,
            score: result.score,
            risk_level: result.risk_level,
            api_source: result.api_source,
            scan_status: 'complete',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
          }, { onConflict: 'check_type,content_hash' });
        } else {
          // Definitive incomplete result (providers answered/failed): release
          // the pending marker so a later retry is safe.
          await supabase.from('check_cache').delete()
            .eq('check_type', 'link')
            .eq('content_hash', urlHash)
            .eq('scan_status', 'pending');
        }
      } else {
        // Long-poll mode: only cache complete two-provider scans; partial
        // detections are ephemeral.
        if (apiResult.scan_status === 'complete') {
          await supabase.from('check_cache').insert({
          check_type: 'link',
          content_hash: urlHash,
          score: result.score,
          risk_level: result.risk_level,
          api_source: result.api_source,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
          });
        }
      }
    }

    if (!isImpersonating) {
      await supabase.from('checks').insert({
        user_id: dbUser.id,
        check_type: 'link',
        content_hash: urlHash,
        score: result.score,
        risk_level: result.risk_level,
        cached: result.cached,
        api_source: result.api_source,
        credit_source: creditSource
      });
    }

    // Send result
    const riskEmoji = result.risk_level === 'HIGH' ? '🔴' : result.risk_level === 'MEDIUM' ? '🟡' : '🟢';
    const scorePercent = (result.score * 100).toFixed(1);
    
    // Get Referral Link for Share
    const refCode = dbUser?.referral_code || '';
    const botUsername = ctx.me.username;
    const shareLink = `https://t.me/${botUsername}?start=${refCode}`;
    const coverageNote = result.scan_status === 'partial' ? ' (partial scan; one provider unavailable)' : '';
    const shareText = `I just checked this link with @${botUsername}!\n\nLink: ${url}\nResult: ${riskEmoji} ${result.risk_level} (${scorePercent}% Risk)${coverageNote}\n\nCheck yours here: ${shareLink}`;

    const safeUrl = url.replace(/`/g, '%60');

    // Record the reply phase before the irreversible send; a later delivery
    // seeing 'replying' stops as ambiguous instead of risking a duplicate.
    throwIfAborted(ntf);
    if (ntf && updateId !== undefined) {
      await markReplyPhase(supabase, updateId, ntf, 'replying');
    }
    await ctx.reply(`${riskEmoji} *Link Check Result*

URL: \`${safeUrl}\`
Risk Level: *${result.risk_level}*
Threat Probability: *${scorePercent}%*

${result.scan_status === 'partial' ? '⚠️ *Partial analysis:* one scanning provider was unavailable. A detected threat is still shown, but this result is incomplete.' : (result.cached ? '⚡ Cached result' : '🔄 Fresh analysis')}

⚠️ *Never click suspicious links!*

Need a detailed report? Open the full app for more insights.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Open Full Report', web_app: { url: config.TMA_URL || 'https://google.com' } }],
          [{ text: '📢 Share Result & Earn Credits', url: `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}` }]
        ]
      }
    }, ntf?.signal as never);
    if (ntf && updateId !== undefined) {
      await markReplyPhase(supabase, updateId, ntf, 'replied');
    }

  } catch (error) {
    if (error instanceof AmbiguousOperationError) {
      // Stop-on-ambiguity: tell the user once, do not auto-retry an uncertain scan.
      console.error('Link check stopped as ambiguous:', error.message);
      try {
        await ctx.reply('⚠️ That check was interrupted and I cannot safely confirm whether the scan completed. It will not retry automatically - please send the link again in a few minutes.');
      } catch (noticeError) {
        console.error('Could not send ambiguity notice:', noticeError);
      }
      throw error;
    }
    if (error instanceof ClaimLostError) {
      throw error;
    }
    console.error('Link check error:', error);
    await ctx.reply('❌ Sorry, I couldn\'t check that link. Please try again.');
  }
}

function normalizeUrl(url: string): string {
  try {
    // Basic URL normalization
    let normalized = url.toLowerCase().trim();
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
    const urlObj = new URL(normalized);
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch (e) {
    return url.toLowerCase().trim();
  }
}
