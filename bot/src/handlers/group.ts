import { Context } from 'grammy';
import { supabase } from '../supabase';

export async function handleLinkGroup(ctx: Context) {
  if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
    await ctx.reply('❌ This command can only be used in a group.');
    return;
  }

  const user = ctx.from;
  if (!user) return;

  try {
    // 1. Check user's plan
    const { data: userData } = await supabase
      .from('users')
      .select('id, plan, premium_until')
      .eq('telegram_user_id', user.id.toString())
      .single();

    if (!userData) {
      await ctx.reply('❌ User profile not found. Please start the bot privately first.');
      return;
    }

    // 2. Verify Group Plan
    const validGroupPlans = ['grp_monthly', 'grp_annual', 'org_custom'];
    if (!validGroupPlans.includes(userData.plan)) {
      await ctx.reply(`❌ You don't have a Group Plan.
      
Your current plan: ${userData.plan}

Upgrade to a Group Plan to protect this chat.`);
      return;
    }

    // 3. Check Expiry
    if (new Date(userData.premium_until) < new Date()) {
      await ctx.reply('❌ Your Group Plan has expired. Please renew.');
      return;
    }

    // 4. Verify User is Admin (Telegram side)
    const chatMember = await ctx.getChatMember(user.id);
    if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
      await ctx.reply('❌ You must be an admin of this group to link your premium plan.');
      return;
    }

    // 5. Check if Group is Already Linked (by someone else)
    const { data: existingGroup } = await supabase
      .from('groups')
      .select('admin_user_id, group_name')
      .eq('telegram_group_id', ctx.chat.id.toString())
      .maybeSingle();

    if (existingGroup && existingGroup.admin_user_id !== userData.id) {
      await ctx.reply(`❌ This group is already linked to another admin's plan.
      
Only the original linker can manage this subscription.`);
      return;
    }

    // 6. Check if User has Linked Another Group (One Purchase -> One Group)
    const { data: userLinkedGroup } = await supabase
      .from('groups')
      .select('telegram_group_id, group_name')
      .eq('admin_user_id', userData.id)
      .neq('telegram_group_id', ctx.chat.id.toString()) // Exclude current group (re-linking is fine)
      .maybeSingle();

    if (userLinkedGroup) {
      await ctx.reply(`❌ You have already linked your plan to another group: *${userLinkedGroup.group_name}*
      
You can only link one group per subscription. Unlink the old group first (or contact support).`, { parse_mode: 'Markdown' });
      return;
    }

    // 7. Link Group in DB
    const { error } = await supabase
      .from('groups')
      .upsert({
        telegram_group_id: ctx.chat.id.toString(),
        group_name: ctx.chat.title,
        admin_user_id: userData.id,
        plan: userData.plan,
        premium_until: userData.premium_until,
        premium_owner_id: userData.id,
        autoscan_enabled: true, // Auto-enable features
        updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_group_id' });

    if (error) {
      console.error('Group link error:', error);
      throw error;
    }

    await ctx.reply(`✅ *Group Successfully Linked!*

🛡️ *Protection Active*
👑 *Plan:* ${userData.plan}
📅 *Valid Until:* ${new Date(userData.premium_until).toLocaleDateString()}

Features Enabled:
- Deepfake Detection
- Scam Link Scanning
- Auto-Scan (Images & Links)`, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Link group error:', error);
    await ctx.reply('❌ Failed to link group. Please try again later.');
  }
}
