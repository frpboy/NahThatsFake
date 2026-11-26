import { supabase } from '../supabase';
import { logAdminAction } from '../utils/adminLogger';

/** Minimal structural view of the Supabase client, injectable for tests. */
export type SupabaseLike = Pick<typeof supabase, 'from'>;

// Thresholds
const ABUSE_THRESHOLDS = {
  THROTTLE: 3, // 3 flags/day -> throttle
  TEMP_BAN: 5, // 5 flags/week -> temp ban (7 days)
  HARD_BAN: 10 // 10 flags ever -> hard ban
};

export async function checkAbuseAndEnforce(userId: string, client: SupabaseLike = supabase) {
  const { count: totalFlags, error: totalFlagsError } = await client
    .from('abuse_flags')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (totalFlagsError) {
    console.error('[Abuse Enforcement] Failed to count flags:', totalFlagsError);
    return;
  }

  if (!totalFlags) return;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [todayResult, weekResult] = await Promise.all([
    client
      .from('abuse_flags')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneDayAgo),
    client
      .from('abuse_flags')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneWeekAgo)
  ]);

  if (todayResult.error || weekResult.error) {
    console.error('[Abuse Enforcement] Failed to count recent flags:', todayResult.error || weekResult.error);
    return;
  }

  const flagsToday = todayResult.count || 0;
  const flagsThisWeek = weekResult.count || 0;

  let actionTaken = null;
  let reason = '';

  // Get user details
  const { data: user, error: userError } = await client
    .from('users')
    .select('*')
    .eq('id', userId) // Assuming UUID here, need to handle telegram_id vs UUID conversion
    .single();

  if (userError) {
    console.error('[Abuse Enforcement] Failed to load user for enforcement:', userError);
    return;
  }

  if (!user || user.is_banned) return; // Already banned

  // Check thresholds. Every enforcement write is verified before the
  // action is treated as taken (#416): Supabase reports write failures
  // through the returned `error`, not by throwing. On failure, log an
  // explicit enforcement failure and stop — no audit entry, no success
  // report for an action that never landed.
  if (totalFlags >= ABUSE_THRESHOLDS.HARD_BAN) {
    // Hard Ban
    const { error: updateError } = await client.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Exceeded hard abuse threshold',
      banned_at: new Date().toISOString()
    }).eq('id', userId);

    if (updateError) {
      console.error(`[Abuse Enforcement] ENFORCEMENT FAILURE: could not apply HARD_BAN to user ${userId}:`, updateError);
      return;
    }

    actionTaken = 'HARD_BAN';
    reason = `Total flags: ${totalFlags}`;

  } else if (flagsThisWeek >= ABUSE_THRESHOLDS.TEMP_BAN) {
    // Temp Ban (7 days)
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await client.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Temporary ban (7 days) for abuse',
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil
    }).eq('id', userId);

    if (updateError) {
      console.error(`[Abuse Enforcement] ENFORCEMENT FAILURE: could not apply TEMP_BAN to user ${userId}:`, updateError);
      return;
    }

    actionTaken = 'TEMP_BAN';
    reason = `Weekly flags: ${flagsThisWeek}`;

  } else if (flagsToday >= ABUSE_THRESHOLDS.THROTTLE) {
    // Throttle (24 hours)
    const throttledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await client.from('users').update({
      is_throttled: true,
      throttled_until: throttledUntil
    }).eq('id', userId);

    if (updateError) {
      console.error(`[Abuse Enforcement] ENFORCEMENT FAILURE: could not apply THROTTLE to user ${userId}:`, updateError);
      return;
    }

    actionTaken = 'THROTTLE';
    reason = `Daily flags: ${flagsToday}`;
  }

  if (actionTaken) {
    // Find an admin/owner to attribute this action to (system user)
    const { data: admin } = await client
      .from('users')
      .select('id')
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (admin) {
      // Log the automated action. The enforcement write has already been
      // verified above; if the audit write itself fails, say so rather
      // than letting the action appear unaudited and successful.
      const { error: auditError } = await client.from('admin_logs').insert({
        admin_id: admin.id,
        action: `AUTO_${actionTaken}`,
        details: { reason, totalFlags, flagsToday, flagsThisWeek },
        target_user_id: userId
      });

      if (auditError) {
        console.error(`[Abuse Enforcement] Failed to write audit log for ${actionTaken} on user ${userId}:`, auditError);
      }
    }

    console.log(`[Abuse Enforcement] User ${userId} -> ${actionTaken}: ${reason}`);
  }
}
