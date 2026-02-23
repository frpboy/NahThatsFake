import { Bot } from 'grammy';
import { supabase } from './supabase';
import { generateReferralCode } from './utils/referral';
import { checkCredits } from './utils/credits';
import { processImageCheck } from './handlers/image';
import { processLinkCheck } from './handlers/link';
import { handlePreCheckout, handleSuccessfulPayment } from './handlers/payment';
import { handleLinkGroup } from './handlers/group';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { consentMiddleware } from './middleware/consent';
import { isOwner, isAdmin, getRole } from './utils/roles';
import { logAdminAction } from './utils/adminLogger';
import { startScheduler } from './services/scheduler';
import { config, validateConfig } from './config';

// Validate environment variables
validateConfig();

export const bot = new Bot(config.BOT_TOKEN);

// Start Scheduler
startScheduler();

// Middleware
bot.use(rateLimitMiddleware);

// Global Ban Check Middleware
bot.use(async (ctx, next) => {
  const user = ctx.from;
  if (!user) return next();

  // Bypass for admins/owners
  if (await isAdmin(user.id.toString())) return next();

  const { data } = await supabase
    .from('users')
    .select('is_banned, banned_reason, banned_until, is_throttled, throttled_until')
    .eq('telegram_user_id', user.id.toString())
    .single();

  const now = new Date();

  // Check Ban
  if (data?.is_banned) {
    // Check if ban expired
    if (data.banned_until && new Date(data.banned_until) < now) {
      // Unban automatically (lazy unban)
      await supabase.from('users').update({ 
        is_banned: false, 
        banned_until: null,
        banned_reason: null
      }).eq('telegram_user_id', user.id.toString());
    } else {
      // Still banned
      return;
    }
  }

  // Check Throttle
  if (data?.is_throttled) {
    if (data.throttled_until && new Date(data.throttled_until) < now) {
      // Unthrottle automatically (lazy unthrottle)
      await supabase.from('users').update({
        is_throttled: false,
        throttled_until: null
      }).eq('telegram_user_id', user.id.toString());
    } else {
      // User is throttled - Allow only 1 request per minute? 
      // Or just block for now to keep it simple as "Cooldown"
      // Let's block with a message
      await ctx.reply('⚠️ You are temporarily throttled due to excessive activity. Please try again later.');
      return;
    }
  }

  await next();
});

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
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '👤 My Account' }, { text: '⭐ Premium' }],
          [{ text: '🤖 Bot Info' }, { text: '🛠 Support' }],
          [{ text: '📱 Open App' }]
        ],
        resize_keyboard: true
      }
    });
  } else {
    // Existing user
    await ctx.reply('Welcome back! Send me an image or link to check.', {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '👤 My Account' }, { text: '⭐ Premium' }],
          [{ text: '🤖 Bot Info' }, { text: '🛠 Support' }],
          [{ text: '📱 Open App' }]
        ],
        resize_keyboard: true
      }
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

  const tmaUrl = config.TMA_URL;
  historyText += `\n📱 View full history in the app: ${tmaUrl}`;

  await ctx.reply(historyText, { parse_mode: 'Markdown' });
});

// Command: /premium
bot.command('premium', async (ctx) => {
  await ctx.reply(`⭐ *Go Premium*

Unlock unlimited checks and advanced features:

💎 Individual Monthly: ₹99
💎 Individual Annual: ₹799 (33% off)
💎 Group Monthly: ₹299

Pay with UPI, cards, or Telegram Stars!`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: 'Upgrade Now', web_app: { url: `${config.TMA_URL}/premium.html` } }
      ]]
    }
  });
});

// Command: /linkgroup
bot.command('linkgroup', handleLinkGroup);

// -----------------------------------------------------------------------------
// PAYMENT HANDLERS (STARS)
// -----------------------------------------------------------------------------
bot.on('pre_checkout_query', handlePreCheckout);
bot.on('message:successful_payment', handleSuccessfulPayment);

// -----------------------------------------------------------------------------
// 👑 ADMIN / OWNER COMMANDS
// -----------------------------------------------------------------------------

// Command: /whoami
bot.command('whoami', async (ctx) => {
  if (!ctx.from) return;
  const role = await getRole(ctx.from.id.toString());
  await ctx.reply(`🆔 ID: \`${ctx.from.id}\`\n🎭 Role: *${role.toUpperCase()}*`, {
    parse_mode: 'Markdown'
  });
});

// Command: /admin
bot.command('admin', async (ctx) => {
  if (!ctx.from) return;

  if (!await isAdmin(ctx.from.id.toString())) {
    return ctx.reply('⛔ Access denied');
  }

  await ctx.reply(`👑 *Admin Panel*

/stats – Platform stats 
/users – Total users 
/ban <id> – Ban user
/unban <id> – Unban user
/broadcast – Message all users
/health – System health
/givecredits <id> <amount> – Give credits
/setplan <id> <plan> <days> - Manual plan`, {
    parse_mode: 'Markdown'
  });
});

// Command: /stats
bot.command('stats', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const { count: users } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: checks } = await supabase
    .from('checks')
    .select('*', { count: 'exact', head: true });

  await ctx.reply(`📊 *Platform Stats*

👥 Users: ${users}
🔍 Total Checks: ${checks}`, {
    parse_mode: 'Markdown'
  });
});

// Command: /ban <id> <reason>
bot.command('ban', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ');
  if (!args || args.length < 2) {
    return ctx.reply('Usage: /ban <userId> [reason]');
  }

  const userId = args[1];
  const reason = args.slice(2).join(' ') || 'Violation';

  const { error } = await supabase
    .from('users')
    .update({ 
      is_banned: true, 
      banned_reason: reason, 
      banned_at: new Date().toISOString() 
    })
    .eq('telegram_user_id', userId);

  if (error) {
    return ctx.reply('❌ Failed to ban user. Check user ID.');
  }

  await logAdminAction(ctx.from.id.toString(), 'BAN_USER', { reason }, userId);
  ctx.reply(`🚫 User ${userId} banned. Reason: ${reason}`);
});

// Command: /unban <id>
bot.command('unban', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ');
  if (!args || args.length !== 2) {
    return ctx.reply('Usage: /unban <userId>');
  }

  const userId = args[1];

  const { error } = await supabase
    .from('users')
    .update({ 
      is_banned: false, 
      banned_reason: null, 
      banned_at: null 
    })
    .eq('telegram_user_id', userId);

  if (error) {
    return ctx.reply('❌ Failed to unban user. Check user ID.');
  }

  await logAdminAction(ctx.from.id.toString(), 'UNBAN_USER', {}, userId);
  ctx.reply(`✅ User ${userId} unbanned`);
});

// Command: /givecredits <id> <amount>
bot.command('givecredits', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ');
  if (!args || args.length !== 3) {
    return ctx.reply('Usage: /givecredits <userId> <amount>');
  }

  const userId = args[1];
  const amount = parseInt(args[2]);

  if (isNaN(amount)) {
    return ctx.reply('Invalid amount');
  }

  // Get current credits first
  const { data: user } = await supabase
    .from('users')
    .select('permanent_credits')
    .eq('telegram_user_id', userId)
    .single();

  if (!user) {
    return ctx.reply('User not found');
  }

  const newAmount = (user.permanent_credits || 0) + amount;

  const { error } = await supabase
    .from('users')
    .update({ permanent_credits: newAmount })
    .eq('telegram_user_id', userId);

  if (error) {
    return ctx.reply('❌ Failed to give credits');
  }

  await logAdminAction(ctx.from.id.toString(), 'GIVE_CREDITS', { amount }, userId);
  ctx.reply(`✅ Given ${amount} credits to ${userId}. New balance: ${newAmount}`);
});

// Command: /setplan <id> <plan> <days>
bot.command('setplan', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ');
  if (!args || args.length !== 4) {
    return ctx.reply('Usage: /setplan <userId> <plan_id> <days>');
  }

  const userId = args[1];
  const planId = args[2];
  const days = parseInt(args[3]);

  if (isNaN(days)) {
    return ctx.reply('Invalid days');
  }

  const premiumUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: planId,
      premium_until: premiumUntil,
      updated_at: new Date().toISOString()
    })
    .eq('telegram_user_id', userId);

  if (error) {
    console.error('Set plan error:', error);
    return ctx.reply(`❌ Failed to set plan. Ensure plan ID is valid: ${planId}`);
  }

  await logAdminAction(ctx.from.id.toString(), 'SET_PLAN', { planId, days }, userId);
  ctx.reply(`✅ Set plan ${planId} for user ${userId} for ${days} days.`);
});

// Broadcast State
const broadcastState = new Map<number, boolean>();

// Command: /broadcast
bot.command('broadcast', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  broadcastState.set(ctx.from.id, true);

  await ctx.reply(
`📢 *Broadcast Mode*

Reply to this message with the text you want to send to ALL users.
Type /cancel to abort.`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /cancel
bot.command('cancel', async (ctx) => {
  if (!ctx.from) return;
  
  if (broadcastState.has(ctx.from.id)) {
    broadcastState.delete(ctx.from.id);
    await ctx.reply('❌ Broadcast cancelled');
  }
});

// Command: /health
bot.command('health', async (ctx) => {
  if (!ctx.from || !await isAdmin(ctx.from.id.toString())) return;

  const dbStart = Date.now();
  const { error } = await supabase.from('users').select('id').limit(1);
  const dbLatency = Date.now() - dbStart;

  await ctx.reply(`🏥 *System Health*

✅ Bot: Online
✅ Database: ${error ? '❌ Error' : `Online (${dbLatency}ms)`}
✅ Uptime: ${process.uptime().toFixed(0)}s`, { parse_mode: 'Markdown' });
});

// Group Protection
bot.on('my_chat_member', async (ctx) => {
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

  const status = ctx.myChatMember.new_chat_member.status;
  
  if (status === 'member' || status === 'administrator') {
    await ctx.reply(
`⚠️ *Group Protection Disabled*

This group requires a premium plan.
Contact admin or upgrade to enable protection.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Command: /help
bot.command('help', async (ctx) => {
  if (!ctx.from) return;

  if (await isAdmin(ctx.from.id.toString())) {
    return ctx.reply(`👑 *Admin Help*

Admin:
/admin - Dashboard
/stats - Statistics
/ban <id> - Ban user
/unban <id> - Unban user
/givecredits <id> <n> - Give credits
/setplan <id> <plan> <days> - Manual plan
/broadcast - Send announcement
/whoami - Check role`, { parse_mode: 'Markdown' });
  }

  // Normal user help
  await ctx.reply(`🤖 *Nah That's Fake – Help*

📸 Send an image → AI deepfake check 
🔗 Send a link → Scam & malware check 

Commands:
/start – Get started 
/check – What can I check? 
/credits – View credits 
/refer – Earn free credits 
/history – Recent checks 
/premium – Upgrade plan 

⚠️ Always verify critical info yourself.`, { parse_mode: 'Markdown' });
});

// -----------------------------------------------------------------------------
// MESSAGE HANDLERS
// -----------------------------------------------------------------------------

// Handle images
bot.on('message:photo', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Check consent first (bypass for admins)
  const isUserAdmin = await isAdmin(user.id.toString());
  
  if (!isUserAdmin) {
    const { data: userData } = await supabase
      .from('users')
      .select('consent_given')
      .eq('telegram_user_id', user.id.toString())
      .single();

    if (!userData?.consent_given) {
      await ctx.reply(`⚠️ *Consent Required*

I need your consent to process images. This helps us comply with privacy regulations.

By continuing, you agree to our terms of service and privacy policy.

✅ Tap "I Agree" to continue:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ I Agree', callback_data: 'consent_agree' }
          ]]
        }
      });
      return;
    }
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

// Handle text messages (links and menu buttons)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  
  // Handle menu buttons
  if (text === '👤 My Account') {
    // Trigger /credits logic
    const user = ctx.from;
    if (user) {
      const credits = await checkCredits(user.id.toString());
      await ctx.reply(`💳 *Your Credits*

Daily remaining: ${credits.dailyRemaining}/3
Permanent credits: ${credits.permanentCredits}
Premium: ${credits.isPremium ? '✅ Active' : '❌ Free tier'}

Use /refer to earn more credits!`, { parse_mode: 'Markdown' });
    }
    return;
  }
  
  if (text === '⭐ Premium') {
    // Trigger /premium logic
    await ctx.reply(`⭐ *Go Premium*

Unlock unlimited checks and advanced features:

💎 Individual Monthly: ₹99
💎 Individual Annual: ₹799 (33% off)
💎 Group Monthly: ₹299

Pay with UPI, cards, or Telegram Stars!`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Upgrade Now', web_app: { url: `${config.TMA_URL}/premium.html` } }
        ]]
      }
    });
    return;
  }
  
  if (text === '🤖 Bot Info') {
    // Trigger /help logic
    await ctx.reply(`🧠 *Nah That’s Fake – Help*

📸 Send an image → Deepfake check
🔗 Send a link → Scam & malware scan

Commands:
/credits – View credits
/history – Last checks
/refer – Earn free credits
/premium – Upgrade plan

⚠️ Always verify important info yourself.`, { parse_mode: 'Markdown' });
    return;
  }

  if (text === '🛠 Support') {
    await ctx.reply('For support, please contact @YourSupportHandle or create an issue on GitHub.');
    return;
  }
  
  if (text === '📱 Open App') {
    return ctx.reply('Open app 👇', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open Nah That’s Fake', web_app: { url: config.TMA_URL || 'https://google.com' } }
        ]]
      }
    });
  }

  // Group Check Gate
  if (ctx.chat.type !== 'private') {
    // Check if group has premium (placeholder logic)
    // For now, just return to prevent processing in groups without premium
    // You can add DB check here later
    return;
  }

  // Check if it's a URL
  const urlRegex = /https?:\/\/[^\s]+/;
  if (urlRegex.test(text)) {
    await processLinkCheck(ctx);
  } else {
    // Only show default reply if it's not a command (commands are handled above)
    if (!text.startsWith('/')) {
      await ctx.reply('Send me an image or a link to check, or use /help for commands.');
    }
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
    
    // Set commands for BotFather (suggestions)
    bot.api.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'How to use the bot' },
      { command: 'credits', description: 'View your credits' },
      { command: 'history', description: 'Recent checks' },
      { command: 'refer', description: 'Invite friends and earn credits' },
      { command: 'premium', description: 'Upgrade to premium' },
    ]);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
