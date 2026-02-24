import { supabase } from '../supabase';
import { generateReferralCode } from './referral';

export async function getOrCreateUserByTelegram(telegramUser: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}) {
  const telegramUserId = telegramUser.id.toString();

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (existing) return existing;

  const referralCode = generateReferralCode();
  const { data: created } = await supabase
    .from('users')
    .insert({
      telegram_user_id: telegramUserId,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      username: telegramUser.username,
      referral_code: referralCode,
      daily_credits: 3,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  return created;
}

export async function getUserByTelegramId(telegramUserId: string) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  return data;
}
