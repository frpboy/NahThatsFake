
import { supabase } from '../supabase';

export interface UserCredits {
  dailyRemaining: number;
  permanentCredits: number;
  isPremium: boolean;
}

export async function checkCredits(telegramUserId: string): Promise<UserCredits> {
  const { data: user } = await supabase
    .from('users')
    .select('daily_credits, permanent_credits, plan, premium_until')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!user) {
    return {
      dailyRemaining: 0,
      permanentCredits: 0,
      isPremium: false
    };
  }

  const isPremium = user.plan !== 'free' && new Date(user.premium_until) > new Date();

  return {
    dailyRemaining: user.daily_credits,
    permanentCredits: user.permanent_credits,
    isPremium
  };
}

const OWNER_ID = process.env.OWNER_TELEGRAM_ID;

export async function consumeCredit(telegramUserId: string, type: 'daily' | 'permanent'): Promise<boolean> {
  // 🔥 OWNER = unlimited
  if (OWNER_ID && telegramUserId === OWNER_ID) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('daily_credits, permanent_credits, plan, premium_until')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!user) return false;

  // Premium users have unlimited checks
  if (user.plan !== 'free' && new Date(user.premium_until) > new Date()) {
    return true;
  }

  if (type === 'daily') {
    if (user.daily_credits > 0) {
      await supabase
        .from('users')
        .update({ daily_credits: user.daily_credits - 1 })
        .eq('telegram_user_id', telegramUserId);
      return true;
    }
    // Fallback to permanent credits if daily runs out
    if (user.permanent_credits > 0) {
      await supabase
        .from('users')
        .update({ permanent_credits: user.permanent_credits - 1 })
        .eq('telegram_user_id', telegramUserId);
      return true;
    }
  }

  return false;
}
