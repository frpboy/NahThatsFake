
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { checkCredits, reserveCredit, settleCredit, releaseCredit, CreditReservation } from '../utils/credits';
import { detectDeepfake, checkImageCache, saveImageCache } from '../services/sightengine';
import { checkUrlSafety } from '../services/urlscanner';
import {
  buildSeparateCheckResults,
  formatSeparateCheckResults,
  classifyServiceError,
  CheckOutcome
} from '../services/separateResults';
import { getOrCreateUserByTelegram, getUserByTelegramId } from '../utils/user';
import crypto from 'crypto';
import axios from 'axios';

export async function processImageCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || user.id.toString();
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);

  // Held outside the try so the catch can release the reservation when
  // the check fails before any verdict is delivered (#410).
  let reservation: CreditReservation | null = null;

  try {
    // Get image file ID
    const photo = ctx.message?.photo;
    const document = ctx.message?.document;
    const fileId = photo ? photo[photo.length - 1].file_id : document?.file_id;

    if (!fileId) {
      await ctx.reply('Please send a valid image.');
      return;
    }

    // A photo can arrive with a link in its caption (e.g. a forwarded post).
    // That is TWO checks, and they are always reported as two separate
    // results: the link result is never a verdict on the image, and an
    // image-service timeout is inconclusive for the image only.
    const captionUrl = ctx.message?.caption?.match(/https?:\/\/[^\s]+/)?.[0];

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

🎁 Use /refer to earn free credits`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Reserve one credit atomically, keyed by this Telegram update so a
    // redelivered update cannot debit twice. The reservation is settled
    // once a verdict is delivered and released if the check fails.
    const idempotencyKey = `tg:${ctx.update?.update_id ?? ctx.message?.message_id ?? 'unknown'}:image`;
    reservation = isImpersonating
      ? { source: 'owner', idempotencyKey: null }
      : await reserveCredit(actingTelegramUserId, idempotencyKey, 'image', dbUser);
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
    // not run its own scan, write its own history rows, or
    // settle/release the shared reservation (#471 review). A
    // reservation ADOPTED by reserveCredit's retry belongs to this
    // request, so it proceeds.
    if (reservation?.duplicate && !reservation.adopted) {
      await ctx.reply('♻️ This exact request was already received, so it is not being run twice — and no extra credit was charged.');
      return;
    }

    const creditSource = creditSourceRaw === 'owner' ? 'premium' : creditSourceRaw;

    await ctx.reply('🔍 Analyzing image...');

    // Get file link
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Download image
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');

    // Generate hash for caching
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

    // Check cache
    const cached = await checkImageCache(imageHash);

    let result;
    let imageError: unknown = null;
    if (cached.found && cached.score !== undefined && cached.risk_level !== undefined) {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      // Call Sightengine API
      try {
        const apiResult = await detectDeepfake(imageBuffer);
        result = {
          score: apiResult.score,
          risk_level: apiResult.risk_level,
          cached: false,
          api_source: 'sightengine'
        };

        // Save to cache
        await saveImageCache(imageHash, result.score, result.risk_level, result.api_source);
      } catch (error) {
        // With a caption link there is still a link result to report, so
        // keep the failure as an inconclusive image outcome instead of
        // dropping the whole message. Without one, keep the old behaviour.
        if (!captionUrl) throw error;
        imageError = error;
      }
    }

    if (!isImpersonating && result) {
      // The insert result MUST be checked: supabase-js reports write
      // failures in the result, never by throwing, and an unchecked
      // insert hid a broken checks trigger (every history row lost)
      // for the app's whole life. A history failure still must not
      // block the verdict, so log it loudly and continue.
      const { error: historyError } = await supabase.from('checks').insert({
        user_id: dbUser.id,
        check_type: 'image',
        content_hash: imageHash,
        score: result.score,
        risk_level: result.risk_level,
        cached: result.cached,
        api_source: result.api_source,
        credit_source: creditSource
      });
      if (historyError) {
        console.error('Failed to record check history (image):', historyError);
      }
    }

    // Caption link present: report the image check and the link check as
    // two separate results. A clean link result is not a verdict on the
    // image, and a timed-out image service is inconclusive for the image
    // only — the two are never merged into one verdict.
    if (captionUrl) {
      let linkOutcome: CheckOutcome;
      try {
        const linkResult = await checkUrlSafety(captionUrl);
        linkOutcome = { status: 'complete', score: linkResult.score, risk_level: linkResult.risk_level };

        if (!isImpersonating) {
          const urlHash = crypto.createHash('sha256')
            .update(`urlscanner-v2:${captionUrl.toLowerCase().trim()}`)
            .digest('hex');
          const { error: linkHistoryError } = await supabase.from('checks').insert({
            user_id: dbUser.id,
            check_type: 'link',
            content_hash: urlHash,
            score: linkResult.score,
            risk_level: linkResult.risk_level,
            cached: false,
            api_source: linkResult.sources.join(', ') || 'unknown',
            credit_source: creditSource
          });
          if (linkHistoryError) {
            console.error('Failed to record check history (caption link):', linkHistoryError);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        linkOutcome = {
          status: /inconclusive/i.test(message) ? 'inconclusive' : classifyServiceError(error)
        };
      }

      const imageOutcome: CheckOutcome = result
        ? { status: 'complete', score: result.score, risk_level: result.risk_level }
        : { status: classifyServiceError(imageError) };

      // Deliver the results first; settle or release only after the
      // reply succeeds. Settling first would make an undelivered
      // verdict unrefundable, because a settled reservation cannot be
      // released (#471 review). If the reply throws, the catch releases
      // the still-open reservation.
      const separate = buildSeparateCheckResults({ image: imageOutcome, link: linkOutcome });
      await ctx.reply(formatSeparateCheckResults(separate), { parse_mode: 'Markdown' });

      // One credit covers the whole message. If at least one of the two
      // checks produced a verdict, settle; if both ended inconclusive,
      // release so the user pays nothing for no verdict (#410).
      if (!isImpersonating) {
        if (imageOutcome.status === 'complete' || linkOutcome.status === 'complete') {
          await settleCredit(actingTelegramUserId, reservation);
        } else {
          await releaseCredit(actingTelegramUserId, reservation, 'image_and_link_inconclusive');
        }
      }
      return;
    }

    if (!result) {
      throw new Error('Image analysis failed');
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
    const shareText = `I just checked this image with @${botUsername}!\n\nResult: ${riskEmoji} ${result.risk_level} (${scorePercent}% Fake)\n\nCheck yours here: ${shareLink}`;

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
    });

    // The verdict has been delivered: settle the reservation so the
    // credit stays spent exactly once.
    if (!isImpersonating) {
      await settleCredit(actingTelegramUserId, reservation);
    }

  } catch (error) {
    // The check failed before a verdict was delivered, or the verdict
    // reply itself failed: refund the reservation so the user never
    // pays for a check they didn't get (#410). Settling happens only
    // after a successful reply, so at this point the reservation is
    // still releasable.
    if (!isImpersonating) {
      await releaseCredit(actingTelegramUserId, reservation, 'image_scan_failed');
    }
    console.error('Image check error:', error);
    await ctx.reply('❌ Failed to analyze image. Please try again later.');
  }
}
