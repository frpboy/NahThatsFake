
import { Context, NextFunction } from 'grammy';

const rateLimits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 10;

export async function rateLimitMiddleware(ctx: Context, next: NextFunction) {
  const user = ctx.from;
  if (!user) return next();

  const userId = user.id.toString();
  const now = Date.now();
  
  const userLimit = rateLimits.get(userId) || { count: 0, windowStart: now };

  if (now - userLimit.windowStart > WINDOW_MS) {
    // Reset window
    userLimit.count = 1;
    userLimit.windowStart = now;
  } else {
    userLimit.count++;
  }

  rateLimits.set(userId, userLimit);

  if (userLimit.count > MAX_REQUESTS) {
    // Silent fail or warn user
    // await ctx.reply('⚠️ Rate limit exceeded. Please wait a minute.');
    return; 
  }

  await next();
}
