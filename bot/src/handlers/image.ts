
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { checkCredits, consumeCredit } from '../utils/credits';
import { detectDeepfake, checkImageCache, saveImageCache } from '../services/sightengine';
import { getOrCreateUserByTelegram, getUserByTelegramId } from '../utils/user';
import crypto from 'crypto';
import axios from 'axios';

export async function processImageCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

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

    const creditSourceRaw = isImpersonating ? 'owner' : await consumeCredit(actingTelegramUserId, 'daily');
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
    if (cached.found && cached.score !== undefined && cached.risk_level !== undefined) {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      // Call Sightengine API
      const apiResult = await detectDeepfake(imageBuffer);
      result = {
        score: apiResult.score,
        risk_level: apiResult.risk_level,
        cached: false,
        api_source: 'sightengine'
      };

      // Save to cache
      await saveImageCache(imageHash, result.score, result.risk_level, result.api_source);
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
    const { data: userRef } = await supabase
      .from('users')
      .select('referral_code')
      .eq('telegram_user_id', actingTelegramUserId)
      .single();
    
    const refCode = userRef?.referral_code || '';
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

  } catch (error) {
    console.error('Image check error:', error);
    await ctx.reply('❌ Failed to analyze image. Please try again later.');
  }
}
