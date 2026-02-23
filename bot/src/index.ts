
import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { supabase } from './supabase';
import { generateReferralCode } from './utils/referral';
import { checkCredits } from './utils/credits';
import { processImageCheck } from './handlers/image';
import { processLinkCheck } from './handlers/link';
import { handlePayment } from './handlers/payment';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { consentMiddleware } from './middleware/consent';

dotenv.config();

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('BOT_TOKEN is not defined in .env');
}

export const bot = new Bot(botToken);

// Middleware
bot.use(rateLimitMiddleware);

// Command: /start
bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Check for referral code in start payload
  const startPayload = ctx.match;
  let referredBy = null;
  
  if (startPayload) {
    // Validate referral code
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', startPayload)
      .single();
    
    if (referrer) {
      referredBy = startPayload;
    }
  }

  // Register/update user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', user.id.toString())
    .single();

  if (!existingUser) {
    // New user - generate referral code
    const referralCode = generateReferralCode();
    
    await supabase.from('users').insert({
      telegram_user_id: user.id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      referral_code: referralCode,
      referred_by: referredBy,
      updated_at: new Date().toISOString()
    });

    // Send welcome message
    await ctx.reply(`🤖 *Nah That's Fake* - Your BS Detector

Welcome! I'm here to help you spot fake images and scam links.

📸 Send me an image to check if it's AI-generated
🔗 Send me a link to verify if it's safe
💰 Start with 3 free checks daily + bonus credits

Ready to catch some fakes? Send me something to check!`, {
      parse_mode: 'Markdown'
    });
  } else {
    // Existing user
    await ctx.reply('Welcome back! Send me an image or link to check.', {
      parse_mode: 'Markdown'
    });
  }
});

// Command: /check
bot.command('check', async (ctx) => {
  await ctx.reply('Please send the image or link you want to check.');
});

// Command: /credits
bot.command('credits', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const credits = await checkCredits(user.id.toString());
  
  await ctx.reply(`💳 *Your Credits*

Daily remaining: ${credits.dailyRemaining}/3
Permanent credits: ${credits.permanentCredits}
Premium: ${credits.isPremium ? '✅ Active' : '❌ Free tier'}

Use /refer to earn more credits!`, {
    parse_mode: 'Markdown'
  });
});

// Command: /refer
bot.command('refer', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Get or create referral code
  const { data } = await supabase
    .from('users')
    .select('referral_code')
    .eq('telegram_user_id', user.id.toString())
    .single();

  let referralCode = data?.referral_code;
  
  if (!referralCode) {
    referralCode = generateReferralCode();
    await supabase
      .from('users')
      .update({ referral_code: referralCode })
      .eq('telegram_user_id', user.id.toString());
  }

  const botUsername = ctx.me.username;
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

  await ctx.reply(`🎁 *Refer Friends, Earn Credits*

Share this link: ${referralLink}

📈 You get: 1 credit per friend
🎉 They get: 2 bonus credits

*Total referrals so far: 0*`, {
    parse_mode: 'Markdown'
  });
});

// Command: /history
bot.command('history', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const { data: checks } = await supabase
    .from('checks')
    .select('*')
    .eq('user_id', user.id.toString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (!checks || checks.length === 0) {
    await ctx.reply('No checks yet. Send me an image or link to get started!');
    return;
  }

  let historyText = '📊 *Your Recent Checks*\n\n';
  checks.forEach((check, index) => {
    const date = new Date(check.created_at).toLocaleDateString();
    const type = check.check_type === 'image' ? '🖼️' : '🔗';
    const risk = check.risk_level || 'Unknown';
    const score = check.score ? (check.score * 100).toFixed(1) : 'N/A';
    
    historyText += `${index + 1}. ${type} ${date} - ${risk} (${score}%)\n`;
  });

  historyText += '\n📱 View full history in the app: [Open TMA]';

  await ctx.reply(historyText, { parse_mode: 'Markdown' });
});

// Command: /premium
bot.command('premium', async (ctx) => {
  await ctx.reply(`⭐ *Go Premium*

Unlock unlimited checks and advanced features:

💎 Individual Monthly: ₹99
💎 Individual Annual: ₹799 (33% off)
💎 Group Monthly: ₹299

Pay with UPI, cards, or Telegram Stars!

[Upgrade Now]`, {
    parse_mode: 'Markdown'
  });
});

// Handle images
bot.on('message:photo', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Check consent first
  const { data: userData } = await supabase
    .from('users')
    .select('consent_given')
    .eq('telegram_user_id', user.id.toString())
    .single();

  if (!userData?.consent_given) {
    await ctx.reply('⚠️ *Consent Required*

I need your consent to process images. This helps us comply with privacy regulations.

By continuing, you agree to our terms of service and privacy policy.

✅ Tap "I Agree" to continue:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ I Agree', callback_data: 'consent_agree' }
        ]]
      }
    });
    return;
  }

  await processImageCheck(ctx);
});

// Handle documents (for images)
bot.on('message:document', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Only process if it's an image
  const mimeType = ctx.message.document.mime_type;
  if (!mimeType?.startsWith('image/')) {
    await ctx.reply('Please send an image file (JPG, PNG, etc.)');
    return;
  }

  await processImageCheck(ctx);
});

// Handle text messages (links)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  
  // Check if it's a URL
  const urlRegex = /https?:\/\/[^\s]+/;
  if (urlRegex.test(text)) {
    await processLinkCheck(ctx);
  } else {
    await ctx.reply('Send me an image or a link to check, or use /help for commands.');
  }
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data === 'consent_agree') {
    const user = ctx.from;
    if (!user) return;

    await supabase
      .from('users')
      .update({ 
        consent_given: true, 
        consent_at: new Date().toISOString() 
      })
      .eq('telegram_user_id', user.id.toString());

    await ctx.answerCallbackQuery('✅ Consent recorded!');
    await ctx.editMessageText('🎉 Thank you! You can now send images and links for checking.');
  }
});

// Start the bot
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started!`);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
