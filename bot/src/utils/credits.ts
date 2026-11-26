import { supabase } from '../supabase';

export interface UserCredits {
  dailyRemaining: number;
  permanentCredits: number;
  isPremium: boolean;
  isOwner: boolean;
}

type CachedUser = { daily_credits: number, permanent_credits: number, plan: string, premium_until: string | null, role: string };

function isPremiumUser(user: CachedUser): boolean {
  return Boolean(user.plan !== 'free' && user.premium_until && new Date(user.premium_until) > new Date());
}

export async function checkCredits(
  telegramUserId: string,
  cachedUser?: CachedUser | null
): Promise<UserCredits> {
  let user = cachedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select('daily_credits, permanent_credits, plan, premium_until, role')
      .eq('telegram_user_id', telegramUserId)
      .single();
    user = data;
  }

  if (!user) {
    return {
      dailyRemaining: 0,
      permanentCredits: 0,
      isPremium: false,
      isOwner: false
    };
  }

  const isOwner = user.role === 'owner';
  const isPremium = isPremiumUser(user);

  return {
    dailyRemaining: user.daily_credits,
    permanentCredits: user.permanent_credits,
    isPremium,
    isOwner
  };
}

// ---------------------------------------------------------------------------
// Atomic credit consumption (plan 1.4, fixes #410)
//
// A check now follows a reserve/settle shape backed by the Postgres
// functions in supabase/migrations/20261125000000_atomic_credits.sql:
//   reserveCredit()  debits daily-then-permanent atomically, exactly once
//                    per idempotency key, and writes the ledger debit row.
//   settleCredit()   marks the reservation final once a verdict is
//                    delivered to the user.
//   releaseCredit()  refunds the reservation when the check ends
//                    inconclusive or a provider fails, so a failed check
//                    never costs a credit.
// Owner and premium users bypass debiting entirely, as before.
// ---------------------------------------------------------------------------

export type CreditSource = 'daily' | 'permanent' | 'premium' | 'owner';

export interface CreditReservation {
  source: CreditSource;
  /** Idempotency key of the DB reservation; null for owner/premium/legacy. */
  idempotencyKey: string | null;
  /** True when this reservation replays an earlier identical request. */
  duplicate?: boolean;
  /**
   * True when a 'duplicate' result was adopted by reserveCredit's own
   * retry after its first attempt's response was lost: the reservation
   * belongs to THIS request, so the handler proceeds with the check
   * instead of standing down like a true duplicate delivery (#471
   * review).
   */
  adopted?: boolean;
  /** True when the debit used the legacy non-atomic fallback (see below). */
  legacy?: boolean;
}

/**
 * Thrown by reserveCredit when the credit service itself fails (RPC
 * error after a retry, or an unexpected result), as opposed to the user
 * simply having no credits (which returns null). Handlers let it
 * propagate to their catch, which replies with a retryable error instead
 * of the misleading "no credits left" message (#471 review).
 */
export class CreditServiceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'CreditServiceError';
  }
}

interface RpcErrorLike {
  code?: string;
  message?: string;
}

interface RpcResult {
  data: any;
  error: RpcErrorLike | null;
}

/** Injectable RPC seam for tests; production default uses the real client. */
export interface CreditRpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
}

const defaultRpcClient: CreditRpcClient = {
  rpc: async (fn, args) => {
    const { data, error } = await supabase.rpc(fn as any, args as any);
    return { data, error };
  }
};

export interface CreditDeps {
  rpc?: CreditRpcClient;
  legacyConsume?: (
    telegramUserId: string,
    user: CachedUser
  ) => Promise<'daily' | 'permanent' | null>;
  legacyRelease?: (
    telegramUserId: string,
    source: 'daily' | 'permanent'
  ) => Promise<void>;
}

/**
 * True only when the reserve_credit function itself is missing (migration
 * not applied yet). PostgREST reports that as code PGRST202; a bare
 * Postgres undefined-function surfaces as 42883.
 */
export function isMissingCreditFunctionError(error: RpcErrorLike): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = error.message || '';
  return /reserve_credit/.test(message) && /could not find|does not exist/i.test(message);
}

/**
 * Pre-migration fallback: the old read-then-write debit, kept only so the
 * bot keeps working if code deploys before the migration is applied. It
 * is NOT atomic and writes no ledger rows; every use is logged loudly.
 * The supported rollout is migration first, so this should never run.
 */
async function legacyConsumeCredit(
  telegramUserId: string,
  user: CachedUser
): Promise<'daily' | 'permanent' | null> {
  if (user.daily_credits > 0) {
    const { error } = await supabase
      .from('users')
      .update({ daily_credits: user.daily_credits - 1 })
      .eq('telegram_user_id', telegramUserId);
    if (error) {
      console.error('[Credits] Legacy daily debit failed:', error);
      return null;
    }
    return 'daily';
  }
  if (user.permanent_credits > 0) {
    const { error } = await supabase
      .from('users')
      .update({ permanent_credits: user.permanent_credits - 1 })
      .eq('telegram_user_id', telegramUserId);
    if (error) {
      console.error('[Credits] Legacy permanent debit failed:', error);
      return null;
    }
    return 'permanent';
  }
  return null;
}

/**
 * Compensating refund for a legacy-fallback debit (#471 review): puts
 * the debited credit back so a failed check does not cost the user even
 * in the pre-migration fallback. Unlike release_credit this is a
 * read-then-write increment — the same non-atomic shape as the legacy
 * debit itself — so two legacy operations racing on one balance can
 * still interleave; that residual risk is exactly why the fallback is a
 * stopgap and the migration-first rollout is the supported path.
 */
async function legacyReleaseCredit(
  telegramUserId: string,
  source: 'daily' | 'permanent'
): Promise<void> {
  const { data: user, error: readError } = await supabase
    .from('users')
    .select('daily_credits, permanent_credits')
    .eq('telegram_user_id', telegramUserId)
    .single();
  if (readError || !user) {
    console.error('[Credits] Legacy refund could not load the user balance:', readError);
    return;
  }
  const column = source === 'daily' ? 'daily_credits' : 'permanent_credits';
  const { error } = await supabase
    .from('users')
    .update({ [column]: (user[column] as number) + 1 })
    .eq('telegram_user_id', telegramUserId);
  if (error) {
    console.error('[Credits] Legacy refund failed:', error);
  }
}

export async function reserveCredit(
  telegramUserId: string,
  idempotencyKey: string,
  checkType: 'link' | 'image',
  cachedUser?: CachedUser | null,
  deps: CreditDeps = {}
): Promise<CreditReservation | null> {
  let user = cachedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select('daily_credits, permanent_credits, plan, premium_until, role')
      .eq('telegram_user_id', telegramUserId)
      .single();
    user = data;
  }

  if (!user) return null;

  // Owner/premium bypass stays in code, as before: no debit, nothing to
  // settle or release.
  if (user.role === 'owner') {
    return { source: 'owner', idempotencyKey: null };
  }
  if (isPremiumUser(user)) {
    return { source: 'premium', idempotencyKey: null };
  }

  // A reservation without a key could never be settled or refunded (the
  // SQL function rejects keyless calls for the same reason); fail here
  // instead of debiting into the void.
  if (!idempotencyKey) {
    console.error('[Credits] reserveCredit called without an idempotency key; refusing to debit.');
    return null;
  }

  const rpc = deps.rpc ?? defaultRpcClient;
  const reserveArgs = {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: idempotencyKey,
    p_check_type: checkType
  };

  let { data, error } = await rpc.rpc('reserve_credit', reserveArgs);
  let recovered = false;

  if (error && !isMissingCreditFunctionError(error)) {
    // The reserve is idempotent by key, so one retry is safe — and it
    // recovers the worst failure shape: the first attempt COMMITTED but
    // its response was lost. The retry then replays that reservation as
    // 'duplicate', and this request adopts it (marked below) instead of
    // leaving the debit orphaned with no handler able to settle or
    // release it (#471 review).
    const retry = await rpc.rpc('reserve_credit', reserveArgs);
    if (!retry.error) {
      data = retry.data;
      error = null;
      recovered = true;
    } else if (!isMissingCreditFunctionError(retry.error)) {
      error = retry.error;
    }
  }

  if (error) {
    if (isMissingCreditFunctionError(error)) {
      console.error(
        '[Credits] reserve_credit RPC is unavailable; using the legacy non-atomic debit. ' +
        'Apply supabase/migrations/20261125000000_atomic_credits.sql.',
        error
      );
      const legacy = deps.legacyConsume ?? legacyConsumeCredit;
      const source = await legacy(telegramUserId, user);
      return source ? { source, idempotencyKey: null, legacy: true } : null;
    }
    // A service failure is NOT an empty balance: throwing lets the
    // handlers answer with a retryable error rather than telling a
    // funded user they have no credits (#471 review).
    throw new CreditServiceError('reserve_credit failed', error);
  }

  const status = data?.status as string | undefined;
  const source = data?.source as 'daily' | 'permanent' | undefined;
  switch (status) {
    case 'reserved':
      return source ? { source, idempotencyKey } : null;
    case 'duplicate':
      return source ? { source, idempotencyKey, duplicate: true, adopted: recovered || undefined } : null;
    case 'none':
    case 'no_user':
      return null;
    case 'invalid_key':
      console.error('[Credits] reserve_credit rejected the idempotency key.');
      return null;
    default:
      throw new CreditServiceError(`Unexpected reserve_credit result: ${JSON.stringify(data)}`);
  }
}

export async function settleCredit(
  telegramUserId: string,
  reservation: CreditReservation | null,
  deps: CreditDeps = {}
): Promise<void> {
  if (!reservation || !reservation.idempotencyKey) return;
  const rpc = deps.rpc ?? defaultRpcClient;
  const settleArgs = {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: reservation.idempotencyKey
  };
  // Settling is an idempotent state transition: one retry covers a
  // transient RPC failure. A failure after the retry is still only
  // logged — durably reconciling stuck reservations needs the sweeper
  // follow-up, not a blocking loop here (#471 review).
  let { data, error } = await rpc.rpc('settle_credit', settleArgs);
  if (error) {
    ({ data, error } = await rpc.rpc('settle_credit', settleArgs));
  }
  if (error) {
    console.error('[Credits] settle_credit failed:', error);
  } else if (data?.status === 'already_released') {
    console.error('[Credits] Settle requested for an already-released reservation:', reservation.idempotencyKey);
  }
}

export async function releaseCredit(
  telegramUserId: string,
  reservation: CreditReservation | null,
  reason: string = 'inconclusive',
  deps: CreditDeps = {}
): Promise<void> {
  if (!reservation) return;
  if (!reservation.idempotencyKey) {
    // Owner/premium never debited, so there is nothing to refund. A
    // legacy-fallback debit has no RPC reservation; refund it with the
    // compensating legacy release instead of silently keeping the
    // credit (#471 review).
    if (reservation.legacy && (reservation.source === 'daily' || reservation.source === 'permanent')) {
      const legacyRelease = deps.legacyRelease ?? legacyReleaseCredit;
      await legacyRelease(telegramUserId, reservation.source);
    }
    return;
  }
  const rpc = deps.rpc ?? defaultRpcClient;
  const releaseArgs = {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: reservation.idempotencyKey,
    p_reason: reason
  };
  // Releasing is idempotent too: one retry on a transient RPC failure,
  // so an inconclusive check is not left debited by a blip (#471
  // review). A failure after the retry is logged for reconciliation.
  let { data, error } = await rpc.rpc('release_credit', releaseArgs);
  if (error) {
    ({ data, error } = await rpc.rpc('release_credit', releaseArgs));
  }
  if (error) {
    console.error('[Credits] release_credit failed:', error);
  } else if (data?.status === 'no_reservation') {
    console.error('[Credits] Release requested for an unknown reservation:', reservation.idempotencyKey);
  }
}

/**
 * Backwards-compatible one-shot debit (reserve + settle immediately).
 * New code should use reserveCredit/settleCredit/releaseCredit so failed
 * checks can be refunded.
 */
export async function consumeCredit(
  telegramUserId: string,
  type: 'daily' | 'permanent',
  cachedUser?: CachedUser | null
): Promise<'daily' | 'permanent' | 'premium' | 'owner' | null> {
  const key = `oneshot:${telegramUserId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const reservation = await reserveCredit(telegramUserId, key, 'link', cachedUser);
  if (!reservation) return null;
  await settleCredit(telegramUserId, reservation);
  return reservation.source;
}
