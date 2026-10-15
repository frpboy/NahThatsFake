
import { supabase } from '../supabase';

export interface UserCredits {
  dailyRemaining: number;
  permanentCredits: number;
  isPremium: boolean;
  isOwner: boolean;
}

export async function checkCredits(
  telegramUserId: string,
  cachedUser?: { daily_credits: number, permanent_credits: number, plan: string, premium_until: string | null, role: string } | null
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
  cachedUser?: { daily_credits: number, permanent_credits: number, plan: string, premium_until: string | null, role: string } | null
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
