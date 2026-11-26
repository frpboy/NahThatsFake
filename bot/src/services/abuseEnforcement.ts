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
  // Enforcement calls can overlap (two flags landing together each run a
  // call). A call works from counts and user state read at its start, so
  // its write must not be able to downgrade a more severe action a
  // concurrent call applied in the meantime (#470 review): the TEMP_BAN
  // and THROTTLE writes below are conditional on the user still being
  // unbanned at write time and verify a row actually changed, and the
  // HARD_BAN write clears banned_until so no stale temp-ban expiry can
  // ever unban a permanently banned user.
  if (totalFlags >= ABUSE_THRESHOLDS.HARD_BAN) {
    // Hard Ban
    const { error: updateError } = await client.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Exceeded hard abuse threshold',
      banned_at: new Date().toISOString(),
      banned_until: null
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

    const { data: updatedRows, error: updateError } = await client.from('users').update({
      is_banned: true,
      banned_reason: 'Automated: Temporary ban (7 days) for abuse',
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil
    }).eq('id', userId).eq('is_banned', false).select('id');

    if (updateError) {
      console.error(`[Abuse Enforcement] ENFORCEMENT FAILURE: could not apply TEMP_BAN to user ${userId}:`, updateError);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      // No row matched the still-unbanned condition: a concurrent
      // enforcement call banned this user first (at least as severe as
      // this action). Its call writes the audit entry; this stale call
      // must not overwrite the ban — in particular not a HARD_BAN, whose
      // permanence this write would undo by setting banned_until.
      console.log(`[Abuse Enforcement] TEMP_BAN for user ${userId} superseded by a concurrent ban; leaving the existing ban untouched.`);
      return;
    }

    actionTaken = 'TEMP_BAN';
    reason = `Weekly flags: ${flagsThisWeek}`;

  } else if (flagsToday >= ABUSE_THRESHOLDS.THROTTLE) {
    // Throttle (24 hours)
    const throttledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: updatedRows, error: updateError } = await client.from('users').update({
      is_throttled: true,
      throttled_until: throttledUntil
    }).eq('id', userId).eq('is_banned', false).select('id');

    if (updateError) {
      console.error(`[Abuse Enforcement] ENFORCEMENT FAILURE: could not apply THROTTLE to user ${userId}:`, updateError);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Banned by a concurrent enforcement call after this call read the
      // user: a throttle is moot on a banned user, and claiming/auditing
      // one here would misreport the user's actual state.
      console.log(`[Abuse Enforcement] THROTTLE for user ${userId} superseded by a concurrent ban; leaving the existing state untouched.`);
      return;
    }

    actionTaken = 'THROTTLE';
    reason = `Daily flags: ${flagsToday}`;
  }

  if (actionTaken) {
    // Find an admin/owner to attribute this action to (system user). A
    // failed or empty lookup must not pass silently (#470 review): the
    // enforcement itself stands, but operators need to know it went
    // unaudited rather than discover a missing admin_logs entry later.
    const { data: admin, error: adminError } = await client
      .from('users')
      .select('id')
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (adminError || !admin) {
      console.error(
        `[Abuse Enforcement] ${actionTaken} on user ${userId} could not be audited: no owner account available to attribute the audit entry.`,
        adminError ?? ''
      );
    }

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
