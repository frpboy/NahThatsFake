import { supabase } from '../supabase';
import { checkAbuseAndEnforce } from './abuseEnforcement';

/** Minimal structural view of the Supabase client, injectable for tests. */
export type SupabaseLike = Pick<typeof supabase, 'from'>;

export async function flagUser(
  userId: string, // UUID
  flagType: string,
  details: any,
  client: SupabaseLike = supabase
) {
  try {
    // Insert flag. Supabase reports write failures through the returned
    // `error`, not by throwing, so the result must be inspected before
    // the flag can be treated as recorded (#414). The Oct 2026 migration
    // hardened the abuse_flags RLS policy (who may insert); it did not
    // add any error handling here.
    const { error: insertError } = await client.from('abuse_flags').insert({
      user_id: userId,
      flag_type: flagType,
      details,
      auto_action: 'pending' // Will be updated by enforcement if action taken
    });

    if (insertError) {
      console.error('[Abuse Detection] Failed to record abuse flag:', insertError);
      return;
    }

    // Trigger enforcement only for a flag that actually persisted.
    await checkAbuseAndEnforce(userId, client);

  } catch (error) {
    console.error('Error flagging user:', error);
  }
}
