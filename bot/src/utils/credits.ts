import { supabase } from '../supabase';

export interface UserCreditRow {
  daily_credits: number;
  permanent_credits: number;
  plan: string;
  premium_until: string | null;
  role: string;
  daily_credits_date?: string | null;
}

const CREDIT_SELECT = 'daily_credits, permanent_credits, plan, premium_until, role, daily_credits_date';

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function isPremiumActive(user: UserCreditRow): boolean {
  return Boolean(user.plan !== 'free' && user.premium_until && new Date(user.premium_until) > new Date());
}

/**
 * Lazy daily-credit reset, replacing the midnight-IST cron for webhook mode.
 * Free users - and users whose premium has expired (effectively free) - get 3
 * daily credits per IST calendar day. The conditional update must match the
 * stale date we observed and actually update a row; on a conflicting
 * concurrent write the row is re-read instead of fabricating 3 credits.
 */
export async function applyLazyDailyReset(
  telegramUserId: string,
  user: UserCreditRow,
  client: Pick<typeof supabase, 'from'> = supabase
): Promise<UserCreditRow> {
  if (isPremiumActive(user)) return user;
  const today = todayIST();
  if (user.daily_credits_date && user.daily_credits_date >= today) return user;

  let query = client
    .from('users')
    .update({ daily_credits: 3, daily_credits_date: today })
    .eq('telegram_user_id', telegramUserId);
  query = user.daily_credits_date == null
    ? query.is('daily_credits_date', null)
    : query.eq('daily_credits_date', user.daily_credits_date);

  const { data: updated, error } = await query.select('daily_credits, daily_credits_date');

  if (error) {
    console.error('[credits] lazy daily reset failed:', error);
    return user;
  }
  if (updated && updated.length > 0) {
    return { ...user, daily_credits: updated[0].daily_credits, daily_credits_date: updated[0].daily_credits_date };
  }
  // Stale read: another invocation changed the row first. Use the fresh row.
  const { data: fresh, error: rereadError } = await client
    .from('users')
    .select(CREDIT_SELECT)
    .eq('telegram_user_id', telegramUserId)
    .single();
  if (rereadError || !fresh) {
    console.error('[credits] lazy reset re-read failed:', rereadError);
    return user;
  }
  return fresh as UserCreditRow;
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
      .select(CREDIT_SELECT)
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
  const isPremium = isPremiumActive(user);

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
  cachedUser?: UserCreditRow | null,
  updateId?: number
): Promise<'daily' | 'permanent' | 'premium' | 'owner' | null> {
  // Idempotent atomic path (webhook deliveries carry update_id): row lock +
  // lazy reset + decrement + idempotency ledger in one transaction (see
  // consume_credit_atomic in supabase/migrations/20261116000001_webhook_support.sql).
  if (updateId !== undefined) {
    const { data, error } = await supabase.rpc('consume_credit_atomic', {
      p_telegram_user_id: telegramUserId,
      p_update_id: updateId
    });
    if (error) {
      console.error('[credits] atomic credit consumption failed:', error);
      return null;
    }
    return (data as 'daily' | 'permanent' | 'premium' | 'owner' | null) ?? null;
  }

  // Legacy path (no update id): lazy reset, then a guarded decrement that must
  // actually match a row so concurrent requests cannot double-spend.
  let user = cachedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select(CREDIT_SELECT)
      .eq('telegram_user_id', telegramUserId)
      .single();
    user = data;
  }

  if (!user) return null;

  user = await applyLazyDailyReset(telegramUserId, user);

  if (user.role === 'owner') {
    return 'owner';
  }

  if (isPremiumActive(user)) {
    return 'premium';
  }

  if (type === 'daily') {
    if (user.daily_credits > 0) {
      const { data, error } = await supabase
        .from('users')
        .update({ daily_credits: user.daily_credits - 1 })
        .eq('telegram_user_id', telegramUserId)
        .eq('daily_credits', user.daily_credits)
        .select('daily_credits');
      if (error) {
        console.error('[credits] daily credit decrement failed:', error);
        return null;
      }
      // 0 rows means a concurrent request spent the credit we observed.
      return data && data.length > 0 ? 'daily' : null;
    }
    // Fallback to permanent credits if daily runs out
    if (user.permanent_credits > 0) {
      const { data, error } = await supabase
        .from('users')
        .update({ permanent_credits: user.permanent_credits - 1 })
        .eq('telegram_user_id', telegramUserId)
        .eq('permanent_credits', user.permanent_credits)
        .select('permanent_credits');
      if (error) {
        console.error('[credits] permanent credit decrement failed:', error);
        return null;
      }
      return data && data.length > 0 ? 'permanent' : null;
    }
  }

  return null;
}
