import { supabase } from '../supabase';
import { logAdminAction } from '../utils/adminLogger';

// Thresholds
const ABUSE_THRESHOLDS = {
  THROTTLE: 3, // 3 flags/day -> throttle
  TEMP_BAN: 5, // 5 flags/week -> temp ban (7 days)
  HARD_BAN: 10 // 10 flags ever -> hard ban
};

export async function checkAbuseAndEnforce(userId: string) {
  // First, get total count to potentially return early
  const { count: totalFlags } = await supabase
    .from('abuse_flags')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (totalFlags === null || totalFlags === 0) return;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Run subsequent time-windowed count queries in parallel
  const [
    { count: flagsToday },
    { count: flagsThisWeek }
  ] = await Promise.all([
    supabase
      .from('abuse_flags')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneDayAgo),
    supabase
      .from('abuse_flags')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneWeekAgo)
  ]);

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
  const total = totalFlags;
  const today = flagsToday ?? 0;
  const thisWeek = flagsThisWeek ?? 0;

  if (total >= ABUSE_THRESHOLDS.HARD_BAN) {
    // Hard Ban
    await supabase.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Exceeded hard abuse threshold',
      banned_at: new Date().toISOString()
    }).eq('id', userId);
    
    actionTaken = 'HARD_BAN';
    reason = `Total flags: ${total}`;

  } else if (thisWeek >= ABUSE_THRESHOLDS.TEMP_BAN) {
    // Temp Ban (7 days)
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabase.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Temporary ban (7 days) for abuse',
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil
    }).eq('id', userId);

    actionTaken = 'TEMP_BAN';
    reason = `Weekly flags: ${thisWeek}`;

  } else if (today >= ABUSE_THRESHOLDS.THROTTLE) {
    // Throttle (24 hours)
    const throttledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('users').update({
      is_throttled: true,
      throttled_until: throttledUntil
    }).eq('id', userId);
    
    actionTaken = 'THROTTLE';
    reason = `Daily flags: ${today}`;
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
        details: { reason, totalFlags: total, flagsToday: today, flagsThisWeek: thisWeek },
        target_user_id: userId
      });
    }
    
    console.log(`[Abuse Enforcement] User ${userId} -> ${actionTaken}: ${reason}`);
  }
}
