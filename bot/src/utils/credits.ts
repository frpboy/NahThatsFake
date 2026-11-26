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
  /** True when the debit used the legacy non-atomic fallback (see below). */
  legacy?: boolean;
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

  const rpc = deps.rpc ?? defaultRpcClient;
  const { data, error } = await rpc.rpc('reserve_credit', {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: idempotencyKey,
    p_check_type: checkType
  });

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
    console.error('[Credits] reserve_credit failed:', error);
    return null;
  }

  const status = data?.status as string | undefined;
  const source = data?.source as 'daily' | 'permanent' | undefined;
  switch (status) {
    case 'reserved':
      return source ? { source, idempotencyKey } : null;
    case 'duplicate':
      return source ? { source, idempotencyKey, duplicate: true } : null;
    case 'none':
    case 'no_user':
      return null;
    default:
      console.error('[Credits] Unexpected reserve_credit result:', data);
      return null;
  }
}

export async function settleCredit(
  telegramUserId: string,
  reservation: CreditReservation | null,
  deps: CreditDeps = {}
): Promise<void> {
  if (!reservation || !reservation.idempotencyKey) return;
  const rpc = deps.rpc ?? defaultRpcClient;
  const { data, error } = await rpc.rpc('settle_credit', {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: reservation.idempotencyKey
  });
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
    // Owner/premium never debited. A legacy-fallback debit cannot be
    // refunded through the RPC; surface that instead of staying silent.
    if (reservation.legacy) {
      console.error('[Credits] Cannot release a legacy-fallback debit; apply the atomic-credits migration.');
    }
    return;
  }
  const rpc = deps.rpc ?? defaultRpcClient;
  const { data, error } = await rpc.rpc('release_credit', {
    p_telegram_user_id: telegramUserId,
    p_idempotency_key: reservation.idempotencyKey,
    p_reason: reason
  });
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
