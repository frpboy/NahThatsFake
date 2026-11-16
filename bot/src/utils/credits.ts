
import { supabase } from '../supabase';


export interface UserCreditRow {
  daily_credits: number;
  permanent_credits: number;
  plan: string;
  premium_until: string | null;
  role: string;
  daily_credits_date?: string | null;
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/**
 * Lazy daily-credit reset, replacing the midnight-IST cron for webhook mode.
 * Free users get 3 daily credits per IST calendar day. If the user's recorded
 * reset date is before today (IST), reset to 3 and stamp the date.
 * No-op for premium plans (unlimited) and when the row lacks the new column value
 * pre-migration semantics (null date -> reset once).
 */
export async function applyLazyDailyReset(
  telegramUserId: string,
  user: UserCreditRow,
  client: Pick<typeof supabase, 'from'> = supabase
): Promise<UserCreditRow> {
  if (user.plan !== 'free') return user;
  const today = todayIST();
  if (user.daily_credits_date && user.daily_credits_date >= today) return user;

  // Guard against clobbering a concurrent reset from another invocation by
  // matching the stale date we observed. A conflicting update makes the query
  // match 0 rows (no error), in which case we keep the observed (stale) row;
  // the next request re-evaluates.
  let query = client
    .from('users')
    .update({ daily_credits: 3, daily_credits_date: today })
    .eq('telegram_user_id', telegramUserId);
  query = user.daily_credits_date == null
    ? query.is('daily_credits_date', null)
    : query.eq('daily_credits_date', user.daily_credits_date);

  const { error } = await query;

  if (error) {
    console.error('[credits] lazy daily reset failed:', error);
    return user;
  }
  return { ...user, daily_credits: 3, daily_credits_date: today };
}

export interface UserCredits {
  dailyRemaining: number;
  permanentCredits: number;
  isPremium: boolean;
  isOwner: boolean;
}

export async function checkCredits(
  telegramUserId: string,
  cachedUser?: UserCreditRow | null
): Promise<UserCredits> {
  let user = cachedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select('daily_credits, permanent_credits, plan, premium_until, role')
      .eq('telegram_user_id', telegramUserId)
      .single();
    user = data;
  }

  if (!user) {
    return {
      dailyRemaining: 0,
      permanentCredits: 0,
      isPremium: false,
      isOwner: false
    };
  }

  user = await applyLazyDailyReset(telegramUserId, user);

  const isOwner = user.role === 'owner';
  const isPremium = Boolean(user.plan !== 'free' && user.premium_until && new Date(user.premium_until) > new Date());

  return {
    dailyRemaining: user.daily_credits,
    permanentCredits: user.permanent_credits,
    isPremium,
    isOwner
  };
}

export async function consumeCredit(
  telegramUserId: string,
  type: 'daily' | 'permanent',
  cachedUser?: UserCreditRow | null
): Promise<'daily' | 'permanent' | 'premium' | 'owner' | null> {
  let user = cachedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select('daily_credits, permanent_credits, plan, premium_until, role')
      .eq('telegram_user_id', telegramUserId)
      .single();
    user = data;
  }

  if (!user) return null;

  user = await applyLazyDailyReset(telegramUserId, user);

  if (user.role === 'owner') {
    return 'owner';
  }

  // Premium users have unlimited checks
  if (user.plan !== 'free' && user.premium_until && new Date(user.premium_until) > new Date()) {
    return 'premium';
  }

  if (type === 'daily') {
    if (user.daily_credits > 0) {
      await supabase
        .from('users')
        .update({ daily_credits: user.daily_credits - 1 })
        .eq('telegram_user_id', telegramUserId);
      return 'daily';
    }
    // Fallback to permanent credits if daily runs out
    if (user.permanent_credits > 0) {
      await supabase
        .from('users')
        .update({ permanent_credits: user.permanent_credits - 1 })
        .eq('telegram_user_id', telegramUserId);
      return 'permanent';
    }
  }

  return null;
}
