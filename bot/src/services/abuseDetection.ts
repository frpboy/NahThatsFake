import { supabase } from '../supabase';
import { checkAbuseAndEnforce } from './abuseEnforcement';
import { recordAbuseFlag } from './abuseDetectionCore';

export { AbuseFlagResult, recordAbuseFlag } from './abuseDetectionCore';

export async function flagUser(
  userId: string, // UUID
  flagType: string,
  details: any
) {
  return recordAbuseFlag(userId, flagType, details, {
    insertFlag: async flag => await supabase.from('abuse_flags').insert(flag),
    enforce: checkAbuseAndEnforce,
    logError: (event, code) => {
      // Never log submitted details or raw database error messages.
      console.error('[Abuse Detection] ' + event, code ? { code } : undefined);
    }
  });
}
