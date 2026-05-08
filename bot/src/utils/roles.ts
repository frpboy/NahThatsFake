import { supabase } from '../supabase';

// Simple in-memory cache for role lookups to prevent database queries on every message
// We use a Map to store the role and the timestamp it was cached
const roleCache = new Map<string, { role: 'owner' | 'admin' | 'user', expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10000; // Prevent memory leaks for huge number of users

export async function getRole(telegramId: string): Promise<'owner' | 'admin' | 'user'> {
  const now = Date.now();

  // Check cache first
  const cached = roleCache.get(telegramId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('telegram_user_id', telegramId)
    .maybeSingle();

  const role = (data?.role as 'owner' | 'admin' | 'user') || 'user';

  // Clean up cache if it gets too large
  if (roleCache.size >= MAX_CACHE_SIZE) {
    // Just clear it completely to avoid O(n) iteration for LRU
    // This is simple and effective enough for a small bot
    roleCache.clear();
  }

  // Store in cache
  roleCache.set(telegramId, {
    role,
    expiresAt: now + CACHE_TTL_MS
  });

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
