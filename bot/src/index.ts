import { Bot, Context } from 'grammy';
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
import { fetchAdsGramAd } from './services/adsgram';
import { checkAbuseAndEnforce } from './services/abuseEnforcement';
import { config, validateConfig } from './config';
import { getOrCreateUserByTelegram, getUserByTelegramId } from './utils/user';

// Validate environment variables
validateConfig();

export const bot = new Bot(config.BOT_TOKEN);

let cachedOwnerTelegramId: string | null = null;

async function resolveOwnerTelegramId(): Promise<string | null> {
  if (cachedOwnerTelegramId) return cachedOwnerTelegramId;

  const { data } = await supabase
    .from('users')
    .select('telegram_user_id')
    .eq('role', 'owner')
    .maybeSingle();

  if (data?.telegram_user_id) {
    cachedOwnerTelegramId = data.telegram_user_id;
    return cachedOwnerTelegramId;
  }

  return null;
}

function getActingTelegramUserId(ctx: Context): string {
  const fromTelegramUserId = ctx.from?.id?.toString() || '';
  return (ctx as any).state?.actingTelegramUserId || fromTelegramUserId;
}

async function sendSponsoredAd(ctx: Context) {
  if (!ctx.from) return;
  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || ctx.from.id.toString();
  if (!config.ADSGRAM_TOKEN || !config.ADSGRAM_BLOCK_ID) {
    await ctx.reply('Sponsored messages are not available right now.');
    return;
  }

  const ad = await fetchAdsGramAd({
    tgid: actingTelegramUserId,
    blockid: config.ADSGRAM_BLOCK_ID,
    language: config.ADSGRAM_LANGUAGE || ctx.from.language_code || 'en',
    token: config.ADSGRAM_TOKEN
  });

  if (!ad) {
    await ctx.reply('No sponsored message available right now.');
    return;
  }

  const inline_keyboard: Array<Array<{ text: string; url: string }>> = [
    [{ text: ad.button_name, url: ad.click_url }]
  ];
  if (ad.button_reward_name && ad.reward_url) {
    inline_keyboard.push([{ text: ad.button_reward_name, url: ad.reward_url }]);
  }

  if (ad.image_url) {
    await ctx.replyWithPhoto(ad.image_url, {
      caption: ad.text_html,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
      protect_content: true
    });
    return;
  }

  await ctx.reply(ad.text_html, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
    protect_content: true
  });
}

type ImpersonationSession = {
  targetTelegramUserId: string;
  targetUserUuid: string;
  logId: string | null;
  expiresAtMs: number;
};

const impersonationSessions = new Map<number, ImpersonationSession>();

async function endImpersonation(ownerTelegramUserId: string, reason: string) {
  const ownerIdNum = Number(ownerTelegramUserId);
  const session = impersonationSessions.get(ownerIdNum);
  if (!session) return;

  impersonationSessions.delete(ownerIdNum);

  if (session.logId) {
    await supabase
      .from('impersonation_logs')
      .update({ ended_at: new Date().toISOString(), reason })
      .eq('id', session.logId);
  }
}

// Debug Middleware - Log all updates
bot.use(async (ctx, next) => {
  if (ctx.message?.text) {
    console.log(`[DEBUG] Text received from ${ctx.from?.id}: "${ctx.message.text}"`);
    console.log(`[DEBUG] Is command? ${ctx.message.text.startsWith('/')}`);
  }
  await next();
});

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

bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (!from) return next();

  const fromTelegramUserId = from.id.toString();
  let actingTelegramUserId = fromTelegramUserId;
  let isImpersonating = false;

  if (await isOwner(fromTelegramUserId)) {
    const session = impersonationSessions.get(from.id);
    if (session) {
      if (Date.now() >= session.expiresAtMs) {
        await endImpersonation(fromTelegramUserId, 'auto_expired');
      } else {
        actingTelegramUserId = session.targetTelegramUserId;
        isImpersonating = true;
      }
    }
  }

  (ctx as any).state.actingTelegramUserId = actingTelegramUserId;
  (ctx as any).state.isImpersonating = isImpersonating;
  (ctx as any).state.realTelegramUserId = fromTelegramUserId;

  await next();
});

// Command: /start
bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const startPayloadRaw = typeof ctx.match === 'string' ? ctx.match.trim() : '';
  let referredBy: string | null = null;
  let referrerUser: { id: string; telegram_user_id: string; referral_code: string | null } | null = null;

  if (startPayloadRaw) {
    const { data: refByCode } = await supabase
      .from('users')
      .select('id, telegram_user_id, referral_code')
      .eq('referral_code', startPayloadRaw)
      .maybeSingle();

    if (refByCode) {
      referrerUser = refByCode;
      referredBy = refByCode.referral_code;
    } else if (/^\d{5,}$/.test(startPayloadRaw)) {
      const { data: refByTelegramId } = await supabase
        .from('users')
        .select('id, telegram_user_id, referral_code')
        .eq('telegram_user_id', startPayloadRaw)
        .maybeSingle();

      if (refByTelegramId) {
        referrerUser = refByTelegramId;
        referredBy = refByTelegramId.referral_code;
      }
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
    
    // Insert new user
    const { data: newUser } = await supabase.from('users').insert({
      telegram_user_id: user.id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      referral_code: referralCode,
      referred_by: referredBy,
      daily_credits: 3,
      updated_at: new Date().toISOString()
    }).select().single();

    if (referredBy && newUser && referrerUser && referrerUser.telegram_user_id !== user.id.toString()) {
      await supabase.rpc('process_referral_reward', {
        referrer_id: referrerUser.id,
        referee_id: newUser.id
      });

      try {
        await ctx.api.sendMessage(
          referrerUser.telegram_user_id,
          `🎉 *New Referral Joined!*

Someone signed up using your link.
💎 You earned +2 credits.

Keep sharing to earn more:
👉 /refer`,
          { parse_mode: 'Markdown' }
        );
      } catch {
        // ignore
      }
    }

    // Send welcome message
    await ctx.reply(`🧠 *Nah That’s Fake — Your BS Detector*

Welcome! I help you spot:
📸 AI-generated / deepfake images
🔗 Scam, phishing & malware links

🎁 You start with:
• 3 free checks every day
• Bonus credits for referrals

Just send an image or a link to begin.
Let’s catch some fakes 👀`, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '👤 My Account' }, { text: '⭐ Premium' }],
          [{ text: '🤖 Bot Info' }, { text: '📝 Feedback' }],
          [{ text: '🛠 Support' }, { text: '📱 Open App' }]
        ],
        resize_keyboard: true
      }
    });
  } else {
    if (startPayloadRaw && referrerUser) {
      await ctx.reply(`ℹ️ You’re already registered.

Referral bonuses apply only to new users.
Send an image or link to continue.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '👤 My Account' }, { text: '⭐ Premium' }],
            [{ text: '🤖 Bot Info' }, { text: '📝 Feedback' }],
            [{ text: '🛠 Support' }, { text: '📱 Open App' }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    await ctx.reply(`👋 Welcome back!

Send an image or a link whenever you’re ready.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '👤 My Account' }, { text: '⭐ Premium' }],
          [{ text: '🤖 Bot Info' }, { text: '📝 Feedback' }],
          [{ text: '🛠 Support' }, { text: '📱 Open App' }]
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

  const credits = await checkCredits(getActingTelegramUserId(ctx));
  
  await ctx.reply(`💳 *Your Credits*

Daily remaining: ${credits.dailyRemaining}/3
Permanent credits: ${credits.permanentCredits}
Premium: ${credits.isPremium ? '✅ Active' : '❌ Free tier'}

Use /refer to earn more credits.`, {
    parse_mode: 'Markdown'
  });
});

bot.command('earn', async (ctx) => {
  await sendSponsoredAd(ctx);
});

// Command: /refer
bot.command('refer', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const actingTelegramUserId = getActingTelegramUserId(ctx);
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);

  // Get or create referral code
  const { data } = await supabase
    .from('users')
    .select('referral_code')
    .eq('telegram_user_id', actingTelegramUserId)
    .single();

  let referralCode = data?.referral_code;
  
  if (!referralCode) {
    if (isImpersonating) {
      await ctx.reply('Referral code is not set for this user. (Impersonation is read-only.)');
      return;
    }
    referralCode = generateReferralCode();
    await supabase
      .from('users')
      .update({ referral_code: referralCode })
      .eq('telegram_user_id', actingTelegramUserId);
  }

  const botUsername = ctx.me.username;
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

  await ctx.reply(`🎁 *Refer Friends, Earn Credits*

Share this link: ${referralLink}

📈 You get: 2 credits per friend
🎉 They get: 1 bonus credit

*Total referrals so far: 0*`, {
    parse_mode: 'Markdown'
  });
});

// Command: /top (Leaderboard)
bot.command('top', async (ctx) => {
  const { data: topUsers } = await supabase
    .from('users')
    .select('first_name, referral_count')
    .order('referral_count', { ascending: false })
    .limit(10);

  if (!topUsers || topUsers.length === 0) {
    return ctx.reply('No data yet.');
  }

  let text = '🏆 *Referral Leaderboard*\n\n';
  topUsers.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    text += `${medal} ${u.first_name || 'User'} - ${u.referral_count || 0} invites\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// Command: /history
bot.command('history', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const actingTelegramUserId = getActingTelegramUserId(ctx);
  const dbUser = actingTelegramUserId === user.id.toString()
    ? await getOrCreateUserByTelegram(user)
    : await getUserByTelegramId(actingTelegramUserId);

  if (!dbUser) {
    await ctx.reply('❌ Target user not found.');
    return;
  }

  const { data: checks } = await supabase
    .from('checks')
    .select('*')
    .eq('user_id', dbUser.id)
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

💎 Individual Weekly: ₹29 / 150 ⭐
💎 Individual Monthly: ₹99 / 500 ⭐
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
  const actingTelegramUserId = (ctx as any).state?.actingTelegramUserId || ctx.from.id.toString();
  const isImpersonating = Boolean((ctx as any).state?.isImpersonating);

  let actingLine = '';
  if (isImpersonating) {
    const { data: target } = await supabase
      .from('users')
      .select('username, first_name')
      .eq('telegram_user_id', actingTelegramUserId)
      .maybeSingle();

    const label = target?.username ? `@${target.username}` : (target?.first_name || 'User');
    actingLine = `\n🕵️ Acting as: *${label}* (ID: \`${actingTelegramUserId}\`)`;
  }

  await ctx.reply(`🆔 ID: \`${ctx.from.id}\`\n👑 Role: *${role.toUpperCase()}*${actingLine}`, { parse_mode: 'Markdown' });
});

bot.command('impersonate', async (ctx) => {
  if (!ctx.from) return;
  if (!await isOwner(ctx.from.id.toString())) return;

  const raw = typeof ctx.match === 'string' ? ctx.match.trim() : '';
  const [targetTelegramUserId, ...reasonParts] = raw.split(/\s+/).filter(Boolean);
  const reason = reasonParts.join(' ') || 'debug';

  if (!targetTelegramUserId || !/^\d{5,}$/.test(targetTelegramUserId)) {
    await ctx.reply('Usage: /impersonate <telegram_user_id> [reason]');
    return;
  }

  const { data: ownerRow } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_user_id', ctx.from.id.toString())
    .maybeSingle();

  const { data: targetUser } = await supabase
    .from('users')
    .select('id, telegram_user_id, username, first_name, is_banned, role')
    .eq('telegram_user_id', targetTelegramUserId)
    .maybeSingle();

  if (!ownerRow) {
    await ctx.reply('❌ Owner record missing in DB (role must be owner).');
    return;
  }

  if (!targetUser) {
    await ctx.reply('❌ Target user not found.');
    return;
  }

  if (targetUser.role === 'owner') {
    await ctx.reply('⛔ Cannot impersonate an owner.');
    return;
  }

  if (targetUser.is_banned) {
    await ctx.reply('⛔ Cannot impersonate a banned user.');
    return;
  }

  const now = Date.now();
  const session: ImpersonationSession = {
    targetTelegramUserId: targetUser.telegram_user_id,
    targetUserUuid: targetUser.id,
    logId: null,
    expiresAtMs: now + 30 * 60 * 1000
  };

  const { data: logRow } = await supabase
    .from('impersonation_logs')
    .insert({
      owner_id: ownerRow.id,
      target_user_id: targetUser.id,
      reason
    })
    .select('id')
    .single();

  session.logId = logRow?.id || null;
  impersonationSessions.set(ctx.from.id, session);

  await logAdminAction(ctx.from.id.toString(), 'IMPERSONATE_START', { reason }, targetTelegramUserId);

  const label = targetUser.username ? `@${targetUser.username}` : (targetUser.first_name || 'User');
  await ctx.reply(`🕵️ *Impersonation started*

You are now acting as:
👤 ${label} (ID: \`${targetTelegramUserId}\`)

This action is logged.
Use /impersonate_off to exit.`, { parse_mode: 'Markdown' });
});

bot.command('impersonate_off', async (ctx) => {
  if (!ctx.from) return;
  if (!await isOwner(ctx.from.id.toString())) return;

  const session = impersonationSessions.get(ctx.from.id);
  if (!session) {
    await ctx.reply('No active impersonation session.');
    return;
  }

  await endImpersonation(ctx.from.id.toString(), 'manual_end');
  await logAdminAction(ctx.from.id.toString(), 'IMPERSONATE_END', {}, session.targetTelegramUserId);
  await ctx.reply('🛑 Impersonation ended. You are now back as Owner.');
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

bot.command('forcegroup', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length !== 4) {
    await ctx.reply('Usage: /forcegroup <group_id> <plan> <days>');
    return;
  }

  const groupId = args[1];
  const plan = args[2];
  const days = Number(args[3]);

  if (!['grp_monthly', 'grp_annual', 'org_custom'].includes(plan)) {
    await ctx.reply('Invalid plan. Allowed: grp_monthly, grp_annual, org_custom');
    return;
  }
  if (!Number.isFinite(days) || days <= 0) {
    await ctx.reply('Invalid days');
    return;
  }

  const { data: ownerRow } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_user_id', ctx.from.id.toString())
    .maybeSingle();

  if (!ownerRow) {
    await ctx.reply('❌ Owner record missing in DB.');
    return;
  }

  const { data: existingGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('telegram_group_id', groupId)
    .maybeSingle();

  const premiumUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  if (!existingGroup) {
    const { error } = await supabase.from('groups').insert({
      telegram_group_id: groupId,
      plan,
      premium_until: premiumUntil,
      premium_owner_id: ownerRow.id,
      updated_at: nowIso
    });

    if (error) {
      await ctx.reply('❌ Failed to create group record');
      return;
    }
  } else {
    const { error } = await supabase
      .from('groups')
      .update({
        plan,
        premium_until: premiumUntil,
        premium_owner_id: ownerRow.id,
        updated_at: nowIso
      })
      .eq('id', existingGroup.id);

    if (error) {
      await ctx.reply('❌ Failed to update group');
      return;
    }
  }

  await logAdminAction(ctx.from.id.toString(), 'FORCE_GROUP_PREMIUM', { plan, days, premiumUntil }, undefined, groupId);

  const planName = plan === 'grp_monthly' ? 'Group Monthly' : plan === 'grp_annual' ? 'Group Annual' : 'Org Custom';
  await ctx.reply(`✅ *Group Premium Activated*

Group ID: \`${groupId}\`
Plan: *${planName}*
Valid until: *${new Date(premiumUntil).toLocaleDateString()}*

This action is logged. This bypasses billing.`, { parse_mode: 'Markdown' });
});

bot.command('unforcegroup', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length !== 2) {
    await ctx.reply('Usage: /unforcegroup <group_id>');
    return;
  }

  const groupId = args[1];
  const { error } = await supabase
    .from('groups')
    .update({ plan: 'free', premium_until: null, updated_at: new Date().toISOString() })
    .eq('telegram_group_id', groupId);

  if (error) {
    await ctx.reply('❌ Failed to downgrade group');
    return;
  }

  await logAdminAction(ctx.from.id.toString(), 'UNFORCE_GROUP', {}, undefined, groupId);
  await ctx.reply('⚠️ Group downgraded to FREE\nPremium features disabled immediately.');
});

bot.command('refund', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const raw = ctx.message?.text || '';
  const parts = raw.split(' ').filter(Boolean);
  if (parts.length < 3) {
    await ctx.reply('Usage: /refund <payment_id> <reason>');
    return;
  }

  const paymentId = parts[1];
  const reason = parts.slice(2).join(' ');

  const { data: payment } = await supabase
    .from('payments')
    .select('id, user_id, plan_id, status, payment_id, premium_until, group_id')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) {
    await ctx.reply('❌ Payment not found');
    return;
  }

  if (payment.status !== 'success') {
    await ctx.reply(`❌ Payment status is ${payment.status}. Only success can be refunded.`);
    return;
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from('payments')
    .update({ status: 'refunded', notes: `Manual refund: ${reason}`, webhook_received_at: nowIso })
    .eq('id', paymentId);

  const { data: user } = await supabase
    .from('users')
    .select('plan, premium_until, last_payment_id, permanent_credits')
    .eq('id', payment.user_id)
    .maybeSingle();

  const isCreditPack = /^credits_\d+$/i.test(payment.plan_id);
  let revokeApplied = false;

  if (user) {
    if (isCreditPack) {
      const m = payment.plan_id.match(/credits_(\d+)/i);
      const credits = m ? Number(m[1]) : 0;
      const newCredits = Math.max((user.permanent_credits || 0) - credits, 0);
      await supabase
        .from('users')
        .update({ permanent_credits: newCredits, updated_at: nowIso })
        .eq('id', payment.user_id);
      revokeApplied = true;
    } else {
      const safeToRevoke = user.last_payment_id === payment.payment_id || (user.plan === payment.plan_id && String(user.premium_until || '') === String(payment.premium_until || ''));
      if (safeToRevoke) {
        await supabase
          .from('users')
          .update({ plan: 'free', premium_until: null, grace_until: null, updated_at: nowIso })
          .eq('id', payment.user_id);
        revokeApplied = true;
      }
    }
  }

  if (payment.group_id) {
    await supabase
      .from('groups')
      .update({ plan: 'free', premium_until: null, payment_id: null, updated_at: nowIso })
      .eq('id', payment.group_id);
  }

  await logAdminAction(ctx.from.id.toString(), 'REFUND_PAYMENT', { paymentId, reason, revokeApplied }, undefined, payment.group_id || undefined);

  await ctx.reply(`💸 *Refund Processed*\n\nPayment ID: \`${paymentId}\`\nPlan: *${payment.plan_id}*\nAccess revoked: *${revokeApplied ? 'YES' : 'NO (newer entitlement detected)'}*\n\nThis action is logged.`, { parse_mode: 'Markdown' });
});

bot.command('simulate_abuse', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length !== 4) {
    await ctx.reply('Usage: /simulate_abuse <telegram_user_id> <type> <count>');
    return;
  }

  const targetTelegramUserId = args[1];
  const type = args[2];
  const count = Number(args[3]);

  if (!Number.isFinite(count) || count <= 0 || count > 200) {
    await ctx.reply('Invalid count (1..200)');
    return;
  }

  const { data: target } = await supabase
    .from('users')
    .select('id, username, first_name, role')
    .eq('telegram_user_id', targetTelegramUserId)
    .maybeSingle();

  if (!target) {
    await ctx.reply('❌ Target user not found');
    return;
  }
  if (target.role === 'owner') {
    await ctx.reply('⛔ Cannot simulate abuse on an owner');
    return;
  }

  const rows = Array.from({ length: count }).map(() => ({
    user_id: target.id,
    flag_type: type,
    details: { simulated: true },
    auto_action: 'pending',
    is_simulated: true
  }));

  await supabase.from('abuse_flags').insert(rows);
  await checkAbuseAndEnforce(target.id);

  const { data: after } = await supabase
    .from('users')
    .select('is_throttled, is_banned')
    .eq('id', target.id)
    .maybeSingle();

  await logAdminAction(ctx.from.id.toString(), 'SIMULATE_ABUSE', { type, count }, targetTelegramUserId);

  const label = target.username ? `@${target.username}` : (target.first_name || 'User');
  await ctx.reply(`🧪 *Abuse Simulation Complete*\n\nUser: *${label}*\nInjected: *${type} × ${count}*\n\nResult:\n• Throttled: *${after?.is_throttled ? 'YES' : 'NO'}*\n• Temp/Hard Ban: *${after?.is_banned ? 'YES' : 'NO'}*\n\n⚠️ Marked as SIMULATED\nThis action is logged.`, { parse_mode: 'Markdown' });
});

bot.command('simulate_abuse_reset', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length !== 2) {
    await ctx.reply('Usage: /simulate_abuse_reset <telegram_user_id>');
    return;
  }

  const targetTelegramUserId = args[1];
  const { data: target } = await supabase
    .from('users')
    .select('id, role')
    .eq('telegram_user_id', targetTelegramUserId)
    .maybeSingle();

  if (!target) {
    await ctx.reply('❌ Target user not found');
    return;
  }
  if (target.role === 'owner') {
    await ctx.reply('⛔ Cannot reset on an owner');
    return;
  }

  await supabase
    .from('abuse_flags')
    .delete()
    .eq('user_id', target.id)
    .eq('is_simulated', true);

  await supabase
    .from('users')
    .update({ is_throttled: false, throttled_until: null, is_banned: false, banned_until: null, banned_reason: null, updated_at: new Date().toISOString() })
    .eq('id', target.id)
    .ilike('banned_reason', 'Automated:%');

  await logAdminAction(ctx.from.id.toString(), 'SIMULATE_ABUSE_RESET', {}, targetTelegramUserId);
  await ctx.reply('✅ Simulated abuse flags cleared.');
});

bot.command('timeline', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length < 2) {
    await ctx.reply('Usage: /timeline <telegram_user_id>');
    return;
  }

  const targetTelegramUserId = args[1];
  const { data: target } = await supabase
    .from('users')
    .select('id, username, first_name, created_at')
    .eq('telegram_user_id', targetTelegramUserId)
    .maybeSingle();

  if (!target) {
    await ctx.reply('❌ User not found');
    return;
  }

  const [payments, checks, abuse, logs, groups] = await Promise.all([
    supabase.from('payments').select('plan_id, status, created_at').eq('user_id', target.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('checks').select('check_type, risk_level, created_at').eq('user_id', target.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('abuse_flags').select('flag_type, is_simulated, created_at').eq('user_id', target.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('admin_logs').select('action, created_at').eq('target_user_id', target.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('groups').select('telegram_group_id, plan, updated_at').eq('admin_user_id', target.id).order('updated_at', { ascending: false }).limit(5)
  ]);

  const events: Array<{ ts: string; text: string }> = [];
  events.push({ ts: target.created_at, text: 'Account created' });

  (payments.data || []).forEach(p => events.push({ ts: p.created_at, text: `Payment: ${p.plan_id} (${p.status})` }));
  (checks.data || []).forEach(c => events.push({ ts: c.created_at, text: `Check: ${c.check_type} ${c.risk_level || ''}`.trim() }));
  (abuse.data || []).forEach(a => events.push({ ts: a.created_at, text: `Abuse flag: ${a.flag_type}${a.is_simulated ? ' (SIMULATED)' : ''}` }));
  (logs.data || []).forEach(l => events.push({ ts: l.created_at, text: `Admin: ${l.action}` }));
  (groups.data || []).forEach(g => events.push({ ts: g.updated_at, text: `Group: ${g.telegram_group_id} plan=${g.plan}` }));

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const top = events.slice(0, 20);
  const label = target.username ? `@${target.username}` : (target.first_name || 'User');
  const lines = top.map(e => `• ${new Date(e.ts).toLocaleDateString()} — ${e.text}`).join('\n');

  await ctx.reply(`📜 *User Timeline — ${label}*\n\n${lines}`, { parse_mode: 'Markdown' });
});

bot.command('groupmap', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const mode = (typeof ctx.match === 'string' ? ctx.match.trim() : '').toLowerCase();
  let query = supabase.from('group_heatmap').select('telegram_group_id, group_name, plan, total_checks, high_risk_pct, abuse_flags');

  if (mode === 'premium') {
    query = query.in('plan', ['grp_monthly', 'grp_annual', 'org_custom']).order('total_checks', { ascending: false });
  } else {
    query = query.order('high_risk_pct', { ascending: false }).order('abuse_flags', { ascending: false });
  }

  const { data } = await query.limit(10);
  if (!data || data.length === 0) {
    await ctx.reply('No group data yet.');
    return;
  }

  const rows = data.map((g: any, i: number) => {
    const name = g.group_name ? ` | ${g.group_name}` : '';
    const plan = String(g.plan || 'free').toUpperCase();
    return `${i + 1}️⃣ ${g.telegram_group_id}${name} | ${g.high_risk_pct}% HIGH | ${g.abuse_flags} flags | ${plan}`;
  }).join('\n');

  await ctx.reply(`🔥 *Group Heatmap*\n\n${rows}`, { parse_mode: 'Markdown' });
});

async function setFeatureFlag(key: string, scope: 'global' | 'user' | 'group', scopeId: string | null, enabled: boolean, description?: string) {
  const { data: existing } = await supabase
    .from('feature_flags')
    .select('id')
    .eq('key', key)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('feature_flags')
      .update({ enabled, description, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }

  await supabase
    .from('feature_flags')
    .insert({ key, scope, scope_id: scopeId, enabled, description, updated_at: new Date().toISOString() });
}

bot.command('flag', async (ctx) => {
  if (!ctx.from || !await isOwner(ctx.from.id.toString())) return;

  const args = ctx.message?.text.split(' ').filter(Boolean) || [];
  if (args.length < 2) {
    await ctx.reply('Usage: /flag list | /flag on <key> | /flag off <key> | /flag user <key> <user_id> on|off | /flag group <key> <group_id> on|off');
    return;
  }

  const sub = args[1];
  if (sub === 'list') {
    const { data } = await supabase
      .from('feature_flags')
      .select('key, enabled, scope, scope_id')
      .order('key', { ascending: true })
      .order('scope', { ascending: true });

    if (!data || data.length === 0) {
      await ctx.reply('No flags set.');
      return;
    }

    const lines = data.map((f: any) => {
      const target = f.scope === 'global' ? 'GLOBAL' : `${String(f.scope).toUpperCase()}:${f.scope_id}`;
      return `• ${f.key} | ${target} | ${f.enabled ? 'ON' : 'OFF'}`;
    }).join('\n');

    await ctx.reply(`🚩 *Feature Flags*\n\n${lines}`, { parse_mode: 'Markdown' });
    return;
  }

  if (sub === 'on' || sub === 'off') {
    const key = args[2];
    if (!key) {
      await ctx.reply('Usage: /flag on <key>');
      return;
    }
    const enabled = sub === 'on';
    await setFeatureFlag(key, 'global', null, enabled);
    await logAdminAction(ctx.from.id.toString(), 'FEATURE_FLAG_UPDATE', { key, enabled, scope: 'global' });
    await ctx.reply(`🚩 Feature Flag Updated\n\nFlag: ${key}\nScope: GLOBAL\nStatus: ${enabled ? 'ENABLED' : 'DISABLED'}\n\nThis action is logged.`);
    return;
  }

  if (sub === 'user' || sub === 'group') {
    if (args.length !== 5) {
      await ctx.reply(`Usage: /flag ${sub} <key> <id> on|off`);
      return;
    }
    const key = args[2];
    const id = args[3];
    const enabled = args[4] === 'on';
    await setFeatureFlag(key, sub as any, id, enabled);
    await logAdminAction(ctx.from.id.toString(), 'FEATURE_FLAG_UPDATE', { key, enabled, scope: sub, scope_id: id }, undefined, sub === 'group' ? id : undefined);
    await ctx.reply(`🚩 Feature Flag Updated\n\nFlag: ${key}\nScope: ${sub.toUpperCase()}\nTarget: ${id}\nStatus: ${enabled ? 'ENABLED' : 'DISABLED'}\n\nThis action is logged.`);
    return;
  }

  await ctx.reply('Unknown /flag command');
});

// Broadcast State
const broadcastState = new Map<number, boolean>();

// Feedback State
interface FeedbackState {
  step: 'waiting_message';
  type: string;
}
const feedbackState = new Map<number, FeedbackState>();

// Reply State (Owner)
interface ReplyState {
  step: 'waiting_reply';
  feedbackId: string;
  targetUserId: string;
}
const replyState = new Map<number, ReplyState>();

// Command: /feedback
bot.command('feedback', async (ctx) => {
  await ctx.reply('What kind of feedback do you have?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💡 Suggestion', callback_data: 'feedback_suggestion' }],
        [{ text: '🐛 Bug Report', callback_data: 'feedback_bug' }],
        [{ text: '😠 Complaint', callback_data: 'feedback_complaint' }],
        [{ text: '💬 Other', callback_data: 'feedback_other' }]
      ]
    }
  });
});

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
/earn – Sponsored message 
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
  const userId = ctx.from?.id;

  if (userId && broadcastState.has(userId) && await isAdmin(userId.toString())) {
    broadcastState.delete(userId);

    const { data: users } = await supabase
      .from('users')
      .select('telegram_user_id')
      .limit(10000);

    const targets = (users || [])
      .map(u => u.telegram_user_id)
      .filter(Boolean);

    let sent = 0;
    let failed = 0;

    for (const tgid of targets) {
      try {
        await ctx.api.sendMessage(tgid, text, { protect_content: true });
        sent++;
      } catch {
        failed++;
      }
    }

    await ctx.reply(`✅ Broadcast sent to ${sent} users${failed ? ` (failed: ${failed})` : ''}.`);
    return;
  }

  if (userId && feedbackState.has(userId)) {
    const state = feedbackState.get(userId);
    if (state?.step === 'waiting_message') {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          telegram_user_id: userId.toString(),
          username: ctx.from?.username,
          first_name: ctx.from?.first_name,
          type: state.type,
          message: text,
          status: 'open'
        })
        .select()
        .single();

      feedbackState.delete(userId);

      if (error) {
        await ctx.reply('❌ Could not submit feedback right now. Please try again.');
        return;
      }

      await ctx.reply('✅ Thanks — your feedback has been submitted.');

      const ownerTelegramId = await resolveOwnerTelegramId();
      if (ownerTelegramId) {
        try {
          await ctx.api.sendMessage(
            ownerTelegramId,
            `📬 *New Feedback (${state.type.toUpperCase()})*\n\nFrom: ${ctx.from?.first_name || 'User'} (@${ctx.from?.username || 'NoUser'})\nID: \`${userId}\`\n\n${text}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Reply', callback_data: `reply_feedback_${data.id}_${userId}` }],
                  [{ text: 'Ignore', callback_data: `ignore_feedback_${data.id}` }]
                ]
              }
            }
          );
        } catch {
          // ignore
        }
      }

      return;
    }
  }

  if (userId && replyState.has(userId)) {
    const state = replyState.get(userId);
    if (state?.step === 'waiting_reply' && await isAdmin(userId.toString())) {
      replyState.delete(userId);

      try {
        await ctx.api.sendMessage(
          state.targetUserId,
          `📬 *Response from Support:*\n\n${text}`,
          { parse_mode: 'Markdown', protect_content: true }
        );

        await supabase
          .from('feedback')
          .update({ status: 'replied', owner_notes: text })
          .eq('id', state.feedbackId);

        await ctx.reply('✅ Reply sent.');
      } catch {
        await ctx.reply('❌ Could not send reply (user may have blocked the bot).');
      }

      return;
    }
  }
  
  // Handle menu buttons
  // Match simplified text or exact button text
  if (text.includes('My Account')) {
    // Trigger /credits logic
    const user = ctx.from;
    if (user) {
      const credits = await checkCredits(getActingTelegramUserId(ctx));
      await ctx.reply(`💳 *Your Credits*

Daily remaining: ${credits.dailyRemaining}/3
Permanent credits: ${credits.permanentCredits}
Premium: ${credits.isPremium ? '✅ Active' : '❌ Free tier'}

Use /refer to earn more credits!`, { parse_mode: 'Markdown' });
    }
    return;
  }
  
  if (text.includes('Premium')) {
    // Trigger /premium logic
    await ctx.reply(`⭐ *Go Premium*

Unlock unlimited checks and advanced features:

💎 Individual Weekly: ₹29 / 150 ⭐
💎 Individual Monthly: ₹99 / 500 ⭐
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
  
  if (text.includes('Bot Info')) {
    // Trigger /help logic
    await ctx.reply(`🧠 *Nah That’s Fake – Help*

📸 Send an image → Deepfake check
🔗 Send a link → Scam & malware scan

Commands:
/credits – View credits
/history – Last checks
/earn – Sponsored message
/refer – Earn free credits
/premium – Upgrade plan
/feedback – Submit suggestion/bug

⚠️ Always verify important info yourself.`, { parse_mode: 'Markdown' });
    return;
  }

  if (text.includes('Feedback')) {
    // Trigger /feedback logic
    await ctx.reply('What kind of feedback do you have?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💡 Suggestion', callback_data: 'feedback_suggestion' }],
          [{ text: '🐛 Bug Report', callback_data: 'feedback_bug' }],
          [{ text: '😠 Complaint', callback_data: 'feedback_complaint' }],
          [{ text: '💬 Other', callback_data: 'feedback_other' }]
        ]
      }
    });
    return;
  }

  if (text.includes('Support')) {
    await ctx.reply('Need help? \n\nUse the "📝 Feedback" button to report bugs or send suggestions directly to the team.\n\nAlternatively, use the /feedback command.');
    return;
  }
  
  if (text.includes('Open App')) {
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
    // Use trim() to handle leading spaces
    if (!text.trim().startsWith('/')) {
      await ctx.reply('Send me an image or a link to check, or use /help for commands.');
    }
  }
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from?.id;
  
  // Feedback Selection
  if (data?.startsWith('feedback_') && userId) {
    const type = data.split('_')[1];
    feedbackState.set(userId, { step: 'waiting_message', type });
    await ctx.answerCallbackQuery();
    await ctx.reply(`Please describe your ${type}. Send it as a text message.`);
    return;
  }

  // Owner Reply
  if (data?.startsWith('reply_feedback_') && userId) {
    if (!await isAdmin(userId.toString())) {
      await ctx.answerCallbackQuery('Not allowed');
      return;
    }
    const parts = data.split('_');
    const feedbackId = parts[2];
    const targetUserId = parts[3];
    
    replyState.set(userId, { step: 'waiting_reply', feedbackId, targetUserId });
    await ctx.answerCallbackQuery();
    await ctx.reply(`Enter your reply for feedback...`);
    return;
  }

  // Owner Ignore
  if (data?.startsWith('ignore_feedback_')) {
    if (!userId || !await isAdmin(userId.toString())) {
      await ctx.answerCallbackQuery('Not allowed');
      return;
    }
    const feedbackId = data.split('_')[2];
    await supabase.from('feedback').update({ status: 'ignored' }).eq('id', feedbackId);
    await ctx.answerCallbackQuery('Marked as ignored');
    try {
      const messageText = (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message)
        ? (ctx.callbackQuery.message.text || '')
        : '';
      if (messageText) {
        await ctx.editMessageText(`${messageText}\n\n[IGNORED]`);
      }
    } catch {
      // ignore
    }
    return;
  }
  
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
      { command: 'feedback', description: 'Submit suggestion/bug' },
    ]);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
