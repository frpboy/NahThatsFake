import { supabase } from '../supabase';

type Role = 'owner' | 'admin' | 'user';

interface CacheEntry {
  role: Role;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const roleCache = new Map<string, CacheEntry>();

/**
 * ⚡ Bolt Performance Optimization:
 * Caching roles reduces DB queries significantly since `isOwner` and `isAdmin`
 * are called on almost every single message via rate limit and ban check middlewares.
 */
export async function getRole(telegramId: string): Promise<Role> {
  const now = Date.now();
  const cached = roleCache.get(telegramId);

  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('telegram_user_id', telegramId)
    .maybeSingle();

  const role = (data?.role as Role) || 'user';

  // Update cache
  roleCache.set(telegramId, {
    role,
    expiresAt: now + CACHE_TTL_MS
  });

  // Cleanup old entries randomly to prevent memory leaks (simple heuristic)
  if (Math.random() < 0.05) {
    for (const [key, entry] of roleCache.entries()) {
      if (entry.expiresAt <= now) {
        roleCache.delete(key);
      }
    }
  }

  return role;
}

export async function isOwner(telegramId: string): Promise<boolean> {
  const role = await getRole(telegramId);
  return role === 'owner';
}

export async function isAdmin(telegramId: string): Promise<boolean> {
  const role = await getRole(telegramId);
  return role === 'owner' || role === 'admin';
}
