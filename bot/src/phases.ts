import type { SupabaseClient } from '@supabase/supabase-js';
import { ClaimLostError, type NtfDeliveryContext } from './errors';

type Client = Pick<SupabaseClient, 'from'>;

/**
 * Durable reply-phase recording (webhook mode only). The result reply is the
 * one irreversible effect with no provider-side idempotency, so the phase is
 * recorded BEFORE the send and confirmed AFTER it:
 * - 'replying' seen by a later delivery -> the reply may have been sent:
 *   stop as ambiguous, never replay it.
 * - 'replied' seen by a later delivery -> work completed: converge to done.
 * In long-poll mode (no delivery context) these are no-ops and behavior is
 * unchanged from before the webhook migration.
 */
export async function markReplyPhase(
  client: Client,
  updateId: number,
  ntf: NtfDeliveryContext | undefined,
  phase: 'replying' | 'replied'
): Promise<void> {
  if (!ntf) return;
  const { data, error } = await client
    .from('processed_updates')
    .update({ reply_phase: phase })
    .eq('update_id', updateId)
    .eq('claim_token', ntf.claimToken)
    .select('update_id');
  if (phase === 'replying' && (error || !data || data.length !== 1)) {
    // Our claim is gone (taken over): sending the reply could duplicate the
    // successor's effects. Abort before the irreversible effect.
    throw new ClaimLostError('lost claim before result reply');
  }
  if (phase === 'replied' && (error || !data || data.length !== 1)) {
    // Tolerated: the reply already happened; the fenced done-write governs
    // completion, and a stale 'replying' marker only makes a later delivery
    // stop conservatively.
    console.error('[phases] could not confirm replied phase:', error ?? 'claim changed');
  }
}
