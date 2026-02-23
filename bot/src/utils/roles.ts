import { supabase } from '../supabase';
import { config } from '../config';

// Checks if user is the Root Owner (env) or has owner/admin role in DB
export async function getRole(telegramId: string): Promise<'owner' | 'admin' | 'user'> {
  // Root owner override
  if (config.OWNER_TELEGRAM_ID && telegramId === config.OWNER_TELEGRAM_ID) {
    return 'owner';
  }

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('telegram_user_id', telegramId)
    .single();

  return (data?.role as 'owner' | 'admin' | 'user') || 'user';
}

export async function isOwner(telegramId: string): Promise<boolean> {
  const role = await getRole(telegramId);
  return role === 'owner';
}

export async function isAdmin(telegramId: string): Promise<boolean> {
  const role = await getRole(telegramId);
  return role === 'owner' || role === 'admin';
}
