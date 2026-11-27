
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { checkCredits, reserveCredit, settleCredit, releaseCredit, CreditReservation } from '../utils/credits';
import { checkUrlSafety } from '../services/urlscanner';
import { getOrCreateUserByTelegram, getUserByTelegramId } from '../utils/user';
import { config } from '../config';
import crypto from 'crypto';

export async function processLinkCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || user.id.toString();
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);
  const text = ctx.message?.text;

  if (!text) return;

  // Held outside the try so the catch can release the reservation when
  // the scan fails or ends inconclusive (#410).
  let reservation: CreditReservation | null = null;

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

🎁 Use /refer to earn free credits`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Reserve one credit atomically, keyed by this Telegram update so a
    // redelivered update cannot debit twice. The reservation is settled
    // once a verdict is delivered and released if the scan fails.
    const idempotencyKey = `tg:${ctx.update?.update_id ?? ctx.message?.message_id ?? 'unknown'}:link`;
    reservation = isImpersonating
      ? { source: 'owner', idempotencyKey: null }
      : await reserveCredit(actingTelegramUserId, idempotencyKey, 'link', dbUser);
    const creditSourceRaw = reservation?.source;
    if (!creditSourceRaw) {
      await ctx.reply(
`🚫 *No credits left*

🎁 Use /refer to earn free credits`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Telegram redelivered an update whose reservation already exists:
    // the original delivery owns that reservation. This delivery must
    // not run its own scan, write its own history row, or settle/release
    // the shared reservation (#471 review). A reservation ADOPTED by
    // reserveCredit's retry belongs to this request, so it proceeds.
    if (reservation?.duplicate && !reservation.adopted) {
      await ctx.reply('♻️ This exact request was already received, so it is not being run twice — and no extra credit was charged.');
      return;
    }

    const creditSource = creditSourceRaw === 'owner' ? 'premium' : creditSourceRaw;

    await ctx.reply('🔍 Analyzing link safety...');

    // Normalize URL for hashing
    const normalizedUrl = normalizeUrl(url);
    // Version the cache key so legacy results are not reused across
    // detection-behaviour changes: v2 predates the PR #459 coverage rules,
    // and v3 supersedes v2 entries written while VirusTotal verdicts could
    // still come from incomplete analyses (fixed in PR #462).
    const urlHash = crypto.createHash('sha256').update(`urlscanner-v3:${normalizedUrl}`).digest('hex');

    // Check cache first
    const { data: cached } = await supabase
      .from('check_cache')
      .select('*')
      .eq('check_type', 'link')
      .eq('content_hash', urlHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    let result;
    if (cached) {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        scan_status: 'complete' as const,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      // Call multiple APIs for link checking
      const apiResult = await checkUrlSafety(url);
      
      result = {
        score: apiResult.score,
        risk_level: apiResult.risk_level,
        scan_status: apiResult.scan_status,
        cached: false,
        api_source: apiResult.sources.join(', ') || 'unknown'
      };
      
      // Only cache complete two-provider scans; partial detections are ephemeral.
      if (apiResult.scan_status === 'complete') {
        const { error: cacheError } = await supabase.from('check_cache').insert({
        check_type: 'link',
        content_hash: urlHash,
        score: result.score,
        risk_level: result.risk_level,
        api_source: result.api_source,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        });
        if (cacheError) {
          console.error('Failed to save link check to cache:', cacheError);
        }
      }
    }

    if (!isImpersonating) {
      // The insert result MUST be checked: supabase-js reports write
      // failures in the result, never by throwing, and an unchecked
      // insert hid a broken checks trigger (every history row lost)
      // for the app's whole life. A history failure still must not
      // block the verdict, so log it loudly and continue.
      const { error: historyError } = await supabase.from('checks').insert({
        user_id: dbUser.id,
        check_type: 'link',
        content_hash: urlHash,
        score: result.score,
        risk_level: result.risk_level,
        cached: result.cached,
        api_source: result.api_source,
        credit_source: creditSource
      });
      if (historyError) {
        console.error('Failed to record check history (link):', historyError);
      }
    }

    // Send result. The reservation is settled only AFTER this reply
    // succeeds (below): settling first would make an undelivered
    // verdict unrefundable, because a settled reservation cannot be
    // released (#471 review).
    const riskEmoji = result.risk_level === 'HIGH' ? '🔴' : result.risk_level === 'MEDIUM' ? '🟡' : '🟢';
    const scorePercent = (result.score * 100).toFixed(1);
    
    // Get Referral Link for Share
    const refCode = dbUser?.referral_code || '';
    const botUsername = ctx.me.username;
    const shareLink = `https://t.me/${botUsername}?start=${refCode}`;
    const coverageNote = result.scan_status === 'partial' ? ' (partial scan; one provider unavailable)' : '';
    const shareText = `I just checked this link with @${botUsername}!\n\nLink: ${url}\nResult: ${riskEmoji} ${result.risk_level} (${scorePercent}% Risk)${coverageNote}\n\nCheck yours here: ${shareLink}`;

    const safeUrl = url.replace(/`/g, '%60');

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
    });

    // The verdict has been delivered: settle the reservation so the
    // credit stays spent exactly once.
    if (!isImpersonating) {
      await settleCredit(actingTelegramUserId, reservation);
    }

  } catch (error) {
    // The scan threw (inconclusive / provider unavailable) or the
    // verdict reply itself failed: refund the reservation so the user
    // never pays for a check they didn't get (#410). Settling happens
    // only after a successful reply, so at this point the reservation
    // is still releasable.
    if (!isImpersonating) {
      await releaseCredit(actingTelegramUserId, reservation, 'link_scan_failed');
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
