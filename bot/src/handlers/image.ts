
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { checkCredits, consumeCredit } from '../utils/credits';
import { detectDeepfake, checkImageCache, saveImageCache, claimImagePendingScan, clearImagePendingScan } from '../services/sightengine';
import { AmbiguousOperationError, ClaimLostError, ScanDefinitiveError, getNtf, throwIfAborted } from '../errors';
import { markReplyPhase } from '../phases';
import { getOrCreateUserByTelegram, getUserByTelegramId } from '../utils/user';
import crypto from 'crypto';
import axios from 'axios';

export async function processImageCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  // Webhook delivery context (undefined in long-poll mode: behavior unchanged).
  const ntf = getNtf(ctx.update);
  const updateId = ctx.update?.update_id;

  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || user.id.toString();
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);
  
  try {
    // Get image file ID
    const photo = ctx.message?.photo;
    const document = ctx.message?.document;
    const fileId = photo ? photo[photo.length - 1].file_id : document?.file_id;

    if (!fileId) {
      await ctx.reply('Please send a valid image.');
      return;
    }

    const dbUser = actingTelegramUserId === user.id.toString()
      ? await getOrCreateUserByTelegram(user)
      : await getUserByTelegramId(actingTelegramUserId);

    if (!dbUser) {
      await ctx.reply('❌ Target user not found.');
      return;
    }

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

    await ctx.reply('🔍 Analyzing image...');

    // Get file link
    const file = await ctx.api.getFile(fileId, ntf?.signal as never);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Download image
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 15000, signal: ntf?.signal });
    const imageBuffer = Buffer.from(response.data, 'binary');

    // Generate hash for caching
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

    // Check cache. A pending marker means a previous attempt may have reached
    // the paid provider. A retry of the SAME update must never re-call on
    // uncertain spend; only a genuinely new user operation (different
    // update_id) may reclaim the marker as a fresh, informed scan decision.
    const cached = await checkImageCache(imageHash);

    let result;
    if (cached.state === 'complete') {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      if (ntf) {
        if (cached.state === 'pending' && cached.pendingUpdateId === updateId) {
          throw new AmbiguousOperationError('this update\'s scan may have reached the provider; not re-calling');
        }
        throwIfAborted(ntf);
        if (updateId === undefined || await claimImagePendingScan(imageHash, updateId) !== 'claimed') {
          throw new AmbiguousOperationError('concurrent or uncertain image scan owns the pending marker; not re-calling');
        }
      }
      throwIfAborted(ntf);
      let apiResult;
      try {
        apiResult = await detectDeepfake(imageBuffer, ntf?.signal);
      } catch (scanError) {
        if (ntf && scanError instanceof ScanDefinitiveError) {
          // The provider answered definitively: no spend uncertainty, release
          // our pending marker so a later retry is safe.
          await clearImagePendingScan(imageHash, updateId);
        }
        // ScanAmbiguousError (or anything else): the pending marker stays, so
        // a later delivery stops instead of re-calling the provider.
        throw scanError;
      }
      throwIfAborted(ntf);
      result = {
        score: apiResult.score,
        risk_level: apiResult.risk_level,
        cached: false,
        api_source: 'sightengine'
      };

      // Persist the result BEFORE the reply phase: the completed scan must be
      // durable before the irreversible reply is attempted. A failed
      // completion write is logged inside; the result is still delivered.
      await saveImageCache(imageHash, result.score, result.risk_level, result.api_source, ntf ? updateId : undefined);
    }

    if (!isImpersonating) {
      await supabase.from('checks').insert({
        user_id: dbUser.id,
        check_type: 'image',
        content_hash: imageHash,
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
    const shareText = `I just checked this image with @${botUsername}!\n\nResult: ${riskEmoji} ${result.risk_level} (${scorePercent}% Fake)\n\nCheck yours here: ${shareLink}`;

    // Record the reply phase before the irreversible send; a later delivery
    // seeing 'replying' stops as ambiguous instead of risking a duplicate.
    throwIfAborted(ntf);
    if (ntf && updateId !== undefined) {
      await markReplyPhase(supabase, updateId, ntf, 'replying');
    }
    await ctx.reply(`${riskEmoji} *Deepfake Detection Result*

Risk Level: *${result.risk_level}*
Artificial Probability: *${scorePercent}%*

${result.cached ? '⚡ Cached result' : '🔄 Fresh analysis'}

⚠️ *Always verify sources yourself!*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Share Result & Earn Credits', url: `https://t.me/share/url?url=${shareLink}&text=${encodeURIComponent(shareText)}` }]
        ]
      }
    }, ntf?.signal as never);
    if (ntf && updateId !== undefined) {
      await markReplyPhase(supabase, updateId, ntf, 'replied');
    }

  } catch (error) {
    if (error instanceof AmbiguousOperationError) {
      // Stop-on-ambiguity: tell the user once, do not auto-retry uncertain spend.
      console.error('Image check stopped as ambiguous:', error.message);
      try {
        await ctx.reply('⚠️ That check was interrupted and I cannot confirm whether the analysis ran, so it will not retry automatically (to avoid a possible duplicate charge). Sending the image again starts a new check and uses a new credit.');
      } catch (noticeError) {
        console.error('Could not send ambiguity notice:', noticeError);
      }
      throw error;
    }
    if (error instanceof ClaimLostError) {
      throw error;
    }
    console.error('Image check error:', error);
    await ctx.reply('❌ Failed to analyze image. Please try again later.');
  }
}
