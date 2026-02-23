import cron from 'node-cron';
import { supabase } from '../supabase';

export function startScheduler() {
  console.log('⏰ Scheduler started...');

  // Run every hour: Check Expired Premium & Abuse Flags
  cron.schedule('0 * * * *', async () => {
    console.log('⏳ Running hourly checks...');
    try {
      // 1. Expired Premium
      const { error } = await supabase.rpc('check_expired_premium');
      if (error) console.error('Expiry check failed:', error);
      
      // 2. Expired Bans (Clean up DB state)
      const now = new Date().toISOString();
      await supabase
        .from('users')
        .update({ is_banned: false, banned_until: null, banned_reason: null })
        .eq('is_banned', true)
        .lt('banned_until', now);

      // 3. Expired Throttles
      await supabase
        .from('users')
        .update({ is_throttled: false, throttled_until: null })
        .eq('is_throttled', true)
        .lt('throttled_until', now);

      console.log('✅ Hourly checks completed');
    } catch (e) {
      console.error('Scheduler error:', e);
    }
  });

  // Run at midnight IST (18:30 UTC): Reset Daily Counters
  cron.schedule('30 18 * * *', async () => {
    console.log('⏳ Resetting daily counters...');
    try {
      // 1. Reset Group Counters via RPC
      await supabase.rpc('reset_daily_counters');
      
      // 2. Reset User Daily Credits (if logic moved to DB, currently mostly in app/credits.ts)
      // Since `credits.ts` uses `daily_credits` column, we should reset it here too.
      // Ideally, create a DB function for this.
      await supabase
        .from('users')
        .update({ daily_credits: 3 }) // Default free credits
        .neq('plan', 'free'); // Premium users have unlimited, but let's reset anyway or handle logic
        
      // Actually, premium logic bypasses credit check.
      // Free users need reset.
      await supabase
        .from('users')
        .update({ daily_credits: 3 })
        .eq('plan', 'free');

      console.log('✅ Daily counters reset');
    } catch (e) {
      console.error('Daily reset error:', e);
    }
  });
}
