
import { Context, NextFunction } from 'grammy';
import { supabase } from '../supabase';

export async function consentMiddleware(ctx: Context, next: NextFunction) {
  // This logic is currently handled inside the message handlers in index.ts
  // Moving it here would be cleaner but for now we just export a dummy function 
  // or the actual logic if we want to refactor.
  // Given the current index.ts structure, this might not be strictly needed as middleware
  // but let's provide a basic pass-through or the logic.
  
  await next();
}
