import { supabase } from '../supabase';
import { persistEnforcementWrite, type AbuseEnforcementAction } from './abuseEnforcementCore';

// Thresholds
const ABUSE_THRESHOLDS = {
  THROTTLE: 3, // 3 flags/day -> throttle
  TEMP_BAN: 5, // 5 flags/week -> temp ban (7 days)
  HARD_BAN: 10 // 10 flags ever -> hard ban
};

const reportWriteFailure = (action: AbuseEnforcementAction, code: string): void => {
  // Keep logs useful without exposing database messages or submitted user data.
  console.error('[Abuse Enforcement] Persistence failed:', { action, code });
};

export async function checkAbuseAndEnforce(userId: string) {
  const { count: totalFlags, error: totalFlagsError } = await supabase
    .from('abuse_flags')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (totalFlagsError) {
    console.error('[Abuse Enforcement] Failed to count flags:', { code: totalFlagsError.code ?? 'database_error' });
    return;
  }

  if (!totalFlags) return;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [todayResult, weekResult] = await Promise.all([
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

  if (todayResult.error || weekResult.error) {
    const error = todayResult.error || weekResult.error;
    console.error('[Abuse Enforcement] Failed to count recent flags:', { code: error?.code ?? 'database_error' });
    return;
  }

  const flagsToday = todayResult.count || 0;
  const flagsThisWeek = weekResult.count || 0;

  let actionTaken: AbuseEnforcementAction | null = null;
  let reason = '';

  // Distinguish a failed lookup from a user that genuinely does not exist.
  const { data: user, error: userLookupError } = await supabase
    .from('users')
    .select('id, is_banned')
    .eq('id', userId)
    .maybeSingle();

  if (userLookupError) {
    console.error('[Abuse Enforcement] Failed to load user for enforcement:', {
      code: userLookupError.code ?? 'database_error'
    });
    return;
  }

  if (!user || user.is_banned) return;

  if (totalFlags >= ABUSE_THRESHOLDS.HARD_BAN) {
    const persisted = await persistEnforcementWrite('HARD_BAN', () => supabase
      .from('users')
      .update({
        is_banned: true,
        banned_reason: 'Automated: Exceeded hard abuse threshold',
        banned_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle(), reportWriteFailure);

    if (!persisted) return;
    actionTaken = 'HARD_BAN';
    reason = `Total flags: ${totalFlags}`;

  } else if (flagsThisWeek >= ABUSE_THRESHOLDS.TEMP_BAN) {
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const persisted = await persistEnforcementWrite('TEMP_BAN', () => supabase
      .from('users')
      .update({
        is_banned: true,
        banned_reason: 'Automated: Temporary ban (7 days) for abuse',
        banned_at: new Date().toISOString(),
        banned_until: bannedUntil
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle(), reportWriteFailure);

    if (!persisted) return;
    actionTaken = 'TEMP_BAN';
    reason = `Weekly flags: ${flagsThisWeek}`;

  } else if (flagsToday >= ABUSE_THRESHOLDS.THROTTLE) {
    const throttledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const persisted = await persistEnforcementWrite('THROTTLE', () => supabase
      .from('users')
      .update({
        is_throttled: true,
        throttled_until: throttledUntil
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle(), reportWriteFailure);

    if (!persisted) return;
    actionTaken = 'THROTTLE';
    reason = `Daily flags: ${flagsToday}`;
  }

  if (actionTaken) {
    const { data: admin, error: adminLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    if (adminLookupError) {
      console.error('[Abuse Enforcement] Failed to find audit actor:', {
        code: adminLookupError.code ?? 'database_error'
      });
    } else if (admin) {
      const { error: auditError } = await supabase.from('admin_logs').insert({
        admin_id: admin.id,
        action: `AUTO_${actionTaken}`,
        details: { reason, totalFlags, flagsToday, flagsThisWeek },
        target_user_id: userId
      });

      if (auditError) {
        console.error('[Abuse Enforcement] Failed to persist audit record:', {
          action: actionTaken,
          code: auditError.code ?? 'database_error'
        });
      }
    }

    // This success log is emitted only after the user update returned its row.
    console.log(`[Abuse Enforcement] User ${userId} -> ${actionTaken}: ${reason}`);
  }
}
