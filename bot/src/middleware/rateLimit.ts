import { Context, NextFunction } from 'grammy';
import { supabase } from '../supabase';
import { flagUser } from '../services/abuseDetection';
import { config } from '../config';

const MAX_REQUESTS = 10;
const ABUSE_TRIGGER_THRESHOLD = 20; // 2x limit -> flag

/**
 * DB-backed rate limiting shared across serverless instances (rate_limit_hit
 * RPC). Semantics preserved from the long-poll in-memory Map: an ELAPSED
 * 60-second window starting at the user's first hit (not aligned to clock
 * minutes), 10 requests per window, silent drop over the limit, abuse flag at
 * 2x. Retried deliveries of the same update are counted once (dedupe by
 * update_id inside the RPC).
 *
 * Failure semantics: a counter-store error or an invalid counter value is
 * TRANSIENT, not a drop and not a silent pass - the user is told once and the
 * error propagates so the webhook marks the delivery failed/retriable
 * (Telegram retries) instead of permanently losing or double-counting a
 * legitimate request. In long-poll mode the thrown error ends processing of
 * that update after the notice; the runner continues with the next update.
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
    p_telegram_user_id: telegramUserId,
    p_update_id: ctx.update?.update_id ?? null
  });

  if (error || typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 1_000_000) {
    if (error) {
      console.error('[rateLimit] counter unavailable:', error);
    } else {
      console.error('[rateLimit] counter returned invalid value:', count);
    }
    try {
      await ctx.reply('⚠️ Service is briefly unavailable - please try again in a moment.');
    } catch (replyError) {
      console.error('[rateLimit] could not send transient-error notice:', replyError);
    }
    throw new Error('rate limit counter unavailable');
  }

  if (count > MAX_REQUESTS) {
    // If they go way over, flag them. A flagging failure must never change
    // the drop decision.
    if (count === ABUSE_TRIGGER_THRESHOLD) {
      try {
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
      } catch (flagError) {
        console.error('[rateLimit] abuse flagging failed:', flagError);
      }
    }

    // Silent fail (policy unchanged)
    return;
  }

  await next();
  };
}

export const rateLimitMiddleware = createRateLimitMiddleware(supabase);
