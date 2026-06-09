import { supabase } from '../supabase';

export async function getRole(telegramId: string, cachedRole?: string): Promise<'owner' | 'admin' | 'user'> {
  if (cachedRole) {
    return cachedRole as 'owner' | 'admin' | 'user';
  }

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('telegram_user_id', telegramId)
    .maybeSingle();

  return (data?.role as 'owner' | 'admin' | 'user') || 'user';
}

export async function isOwner(telegramId: string, cachedRole?: string): Promise<boolean> {
  const role = await getRole(telegramId, cachedRole);
  return role === 'owner';
}

export async function isAdmin(telegramId: string, cachedRole?: string): Promise<boolean> {
  const role = await getRole(telegramId, cachedRole);
  return role === 'owner' || role === 'admin';
}
