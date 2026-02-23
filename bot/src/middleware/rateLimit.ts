import { Context, NextFunction } from 'grammy';
import { supabase } from '../supabase';
import { flagUser } from '../services/abuseDetection';
import { config } from '../config';

const rateLimits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 10;
const ABUSE_TRIGGER_THRESHOLD = 20; // 2x limit -> flag

export async function rateLimitMiddleware(ctx: Context, next: NextFunction) {
  const user = ctx.from;
  if (!user) return next();

  const telegramUserId = user.id.toString();

  // Fast bypass for root owner
  if (telegramUserId === config.OWNER_TELEGRAM_ID) {
    return next();
  }

  const now = Date.now();
  const userLimit = rateLimits.get(telegramUserId) || { count: 0, windowStart: now };

  if (now - userLimit.windowStart > WINDOW_MS) {
    // Reset window
    userLimit.count = 1;
    userLimit.windowStart = now;
  } else {
    userLimit.count++;
  }

  rateLimits.set(telegramUserId, userLimit);

  if (userLimit.count > MAX_REQUESTS) {
    // If they go way over, flag them
    if (userLimit.count === ABUSE_TRIGGER_THRESHOLD) {
       const { data: userData } = await supabase
         .from('users')
         .select('id')
         .eq('telegram_user_id', telegramUserId)
         .single();
         
       if (userData) {
         await flagUser(userData.id, 'rate_limit_exceeded', {
           count: userLimit.count,
           limit: MAX_REQUESTS
         });
       }
    }
    
    // Silent fail
    return; 
  }

  await next();
}
