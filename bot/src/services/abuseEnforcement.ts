import { supabase } from '../supabase';
import { logAdminAction } from '../utils/adminLogger';

// Thresholds
const ABUSE_THRESHOLDS = {
  THROTTLE: 3, // 3 flags/day -> throttle
  TEMP_BAN: 5, // 5 flags/week -> temp ban (7 days)
  HARD_BAN: 10 // 10 flags ever -> hard ban
};

export async function checkAbuseAndEnforce(userId: string) {
  // Get user's abuse flags
  const { data: flags } = await supabase
    .from('abuse_flags')
    .select('*')
    .eq('user_id', userId);

  if (!flags || flags.length === 0) return;

  const totalFlags = flags.length;
  
  // Count flags in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const flagsToday = flags.filter(f => new Date(f.created_at) > oneDayAgo).length;

  // Count flags in last 7 days
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const flagsThisWeek = flags.filter(f => new Date(f.created_at) > oneWeekAgo).length;

  let actionTaken = null;
  let reason = '';

  // Get user details
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId) // Assuming UUID here, need to handle telegram_id vs UUID conversion
    .single();

  if (!user || user.is_banned) return; // Already banned

  // Check thresholds
  if (totalFlags >= ABUSE_THRESHOLDS.HARD_BAN) {
    // Hard Ban
    await supabase.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Exceeded hard abuse threshold',
      banned_at: new Date().toISOString()
    }).eq('id', userId);
    
    actionTaken = 'HARD_BAN';
    reason = `Total flags: ${totalFlags}`;

  } else if (flagsThisWeek >= ABUSE_THRESHOLDS.TEMP_BAN) {
    // Temp Ban (7 days)
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabase.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Temporary ban (7 days) for abuse',
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil
    }).eq('id', userId);

    actionTaken = 'TEMP_BAN';
    reason = `Weekly flags: ${flagsThisWeek}`;

  } else if (flagsToday >= ABUSE_THRESHOLDS.THROTTLE) {
    // Throttle (24 hours)
    const throttledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('users').update({
      is_throttled: true,
      throttled_until: throttledUntil
    }).eq('id', userId);
    
    actionTaken = 'THROTTLE';
    reason = `Daily flags: ${flagsToday}`;
  }

  if (actionTaken) {
    // Find an admin/owner to attribute this action to (system user)
    const { data: admin } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'owner')
      .limit(1)
      .single();
      
    if (admin) {
      // Log the automated action
      await supabase.from('admin_logs').insert({
        admin_id: admin.id,
        action: `AUTO_${actionTaken}`,
        details: { reason, totalFlags, flagsToday, flagsThisWeek },
        target_user_id: userId
      });
    }
    
    console.log(`[Abuse Enforcement] User ${userId} -> ${actionTaken}: ${reason}`);
  }
}
