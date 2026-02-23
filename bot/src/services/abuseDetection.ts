import { supabase } from '../supabase';
import { checkAbuseAndEnforce } from './abuseEnforcement';

export async function flagUser(
  userId: string, // UUID
  flagType: string,
  details: any
) {
  try {
    // Insert flag
    await supabase.from('abuse_flags').insert({
      user_id: userId,
      flag_type: flagType,
      details,
      auto_action: 'pending' // Will be updated by enforcement if action taken
    });

    // Trigger enforcement
    await checkAbuseAndEnforce(userId);

  } catch (error) {
    console.error('Error flagging user:', error);
  }
}
