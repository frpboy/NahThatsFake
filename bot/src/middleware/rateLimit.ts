import { Context, NextFunction } from 'grammy';
import { supabase } from '../supabase';
import { flagUser } from '../services/abuseDetection';
import { config } from '../config';

const MAX_REQUESTS = 10;
const ABUSE_TRIGGER_THRESHOLD = 20; // 2x limit -> flag

/**
 * DB-backed fixed-minute-window rate limiting (rate_limit_hit RPC): counts
 * are shared across serverless instances, unlike the previous per-process
 * in-memory Map. Window boundaries are fixed minutes, so a burst split across
 * a boundary is counted separately - slightly looser than a sliding window.
 * Fails open when the counter store errors so a transient DB issue does not
 * block all bot traffic (every other bot feature depends on the same store).
 */
type RpcClient = Pick<typeof supabase, 'rpc' | 'from'>;

export function createRateLimitMiddleware(client: RpcClient) {
  return async function rateLimitMiddleware(ctx: Context, next: NextFunction) {
  const user = ctx.from;
  if (!user) return next();

  const telegramUserId = user.id.toString();

  // Fast bypass for root owner
  if (telegramUserId === config.OWNER_TELEGRAM_ID) {
    return next();
  }

  const { data: count, error } = await client.rpc('rate_limit_hit', {
    p_telegram_user_id: telegramUserId
  });

  if (error) {
    console.error('[rateLimit] counter unavailable, allowing request:', error);
    return next();
  }

  if (typeof count === 'number' && count > MAX_REQUESTS) {
    // If they go way over, flag them
    if (count === ABUSE_TRIGGER_THRESHOLD) {
      const { data: userData } = await client
        .from('users')
        .select('id')
        .eq('telegram_user_id', telegramUserId)
        .single();

      if (userData) {
        await flagUser(userData.id, 'rate_limit_exceeded', {
          count,
          limit: MAX_REQUESTS
        });
      }
    }

    // Silent fail
    return;
  }

  await next();
  };
}

export const rateLimitMiddleware = createRateLimitMiddleware(supabase);
