import assert from 'node:assert/strict';

// credits.ts builds a Supabase client at import time; give it harmless
// dummy values so the module loads without real credentials. Every test
// injects a fake RPC client, so nothing touches the network or a real DB.
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const credits = require('../src/utils/credits') as typeof import('../src/utils/credits');
const { reserveCredit, settleCredit, releaseCredit, isMissingCreditFunctionError } = credits;

type Source = 'daily' | 'permanent';

interface LedgerRow {
  userId: string;
  delta: number;
  source: Source;
  kind: 'debit' | 'refund';
  key: string | null;
}

/**
 * In-memory model of the reserve/settle/release contract implemented by
 * supabase/migrations/20261125000000_atomic_credits.sql. Each rpc() call
 * yields once (so parallel callers interleave like concurrent requests)
 * and then runs its state transition synchronously, mirroring the
 * atomicity of the single-statement conditional UPDATEs in the SQL.
 */
class FakeCreditStore {
  users = new Map<string, { id: string; daily: number; permanent: number }>();
  reservations = new Map<string, { userId: string; source: Source; state: string }>();
  ledger: LedgerRow[] = [];
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  forcedError: { code?: string; message: string } | null = null;

  addUser(telegramId: string, daily: number, permanent: number): void {
    this.users.set(telegramId, { id: `uuid-${telegramId}`, daily, permanent });
  }

  balance(telegramId: string): { daily: number; permanent: number } {
    const u = this.users.get(telegramId)!;
    return { daily: u.daily, permanent: u.permanent };
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<{ data: any; error: any }> {
    this.rpcCalls.push({ fn, args });
    await new Promise(resolve => setImmediate(resolve));
    if (this.forcedError) return { data: null, error: this.forcedError };
    switch (fn) {
      case 'reserve_credit':
        return { data: this.reserve(args), error: null };
      case 'settle_credit':
        return { data: this.transition(args, 'settled'), error: null };
      case 'release_credit':
        return { data: this.release(args), error: null };
      default:
        return { data: null, error: { message: `unknown function ${fn}` } };
    }
  }

  private reserve(args: Record<string, unknown>): any {
    const telegramId = args.p_telegram_user_id as string;
    const key = args.p_idempotency_key as string | null;
    const user = this.users.get(telegramId);
    if (!user) return { status: 'no_user', source: null };

    const existing = key ? this.reservations.get(key) : undefined;
    if (existing && (existing.userId !== user.id || existing.state === 'reserved' || existing.state === 'settled')) {
      return { status: 'duplicate', source: existing.source };
    }

    let source: Source | null = null;
    if (user.daily > 0) {
      user.daily -= 1;
      source = 'daily';
    } else if (user.permanent > 0) {
      user.permanent -= 1;
      source = 'permanent';
    }
    if (!source) return { status: 'none', source: null };

    if (key) this.reservations.set(key, { userId: user.id, source, state: 'reserved' });
    this.ledger.push({ userId: user.id, delta: -1, source, kind: 'debit', key });
    return { status: 'reserved', source };
  }

  private transition(args: Record<string, unknown>, target: 'settled'): any {
    const key = args.p_idempotency_key as string | null;
    if (!key) return { status: 'no_reservation', source: null };
    const res = this.reservations.get(key);
    if (!res) return { status: 'no_reservation', source: null };
    if (res.state !== 'reserved') return { status: `already_${res.state}`, source: res.source };
    res.state = target;
    return { status: target, source: res.source };
  }

  private release(args: Record<string, unknown>): any {
    const telegramId = args.p_telegram_user_id as string;
    const key = args.p_idempotency_key as string | null;
    if (!key) return { status: 'no_reservation', source: null };
    const res = this.reservations.get(key);
    if (!res) return { status: 'no_reservation', source: null };
    if (res.state !== 'reserved') return { status: `already_${res.state}`, source: res.source };
    res.state = 'released';
    const user = this.users.get(telegramId)!;
    if (res.source === 'daily') user.daily += 1;
    else user.permanent += 1;
    this.ledger.push({ userId: user.id, delta: 1, source: res.source, kind: 'refund', key });
    return { status: 'released', source: res.source };
  }
}

const freeUser = (daily: number, permanent: number) => ({
  daily_credits: daily,
  permanent_credits: permanent,
  plan: 'free',
  premium_until: null,
  role: 'user'
});

async function run(): Promise<void> {
  // Daily credits are spent before permanent ones; one ledger debit row.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 2, 5);
    const res = await reserveCredit('100', 'k1', 'link', freeUser(2, 5), { rpc: store });
    assert.equal(res?.source, 'daily');
    assert.deepEqual(store.balance('100'), { daily: 1, permanent: 5 });
    assert.equal(store.ledger.length, 1);
    assert.equal(store.ledger[0].kind, 'debit');
    assert.equal(store.ledger[0].delta, -1);
  }

  // Permanent credits are the fallback when daily is empty.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 0, 3);
    const res = await reserveCredit('100', 'k1', 'image', freeUser(0, 3), { rpc: store });
    assert.equal(res?.source, 'permanent');
    assert.deepEqual(store.balance('100'), { daily: 0, permanent: 2 });
  }

  // No credits at all ⇒ no reservation, no ledger rows.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 0, 0);
    const res = await reserveCredit('100', 'k1', 'link', freeUser(0, 0), { rpc: store });
    assert.equal(res, null);
    assert.equal(store.ledger.length, 0);
  }

  // Duplicate idempotency key ⇒ original result replayed, no second debit.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 2, 0);
    const first = await reserveCredit('100', 'same-key', 'link', freeUser(2, 0), { rpc: store });
    const second = await reserveCredit('100', 'same-key', 'link', freeUser(2, 0), { rpc: store });
    assert.equal(first?.source, 'daily');
    assert.equal(second?.source, 'daily');
    assert.equal(second?.duplicate, true);
    assert.deepEqual(store.balance('100'), { daily: 1, permanent: 0 });
    assert.equal(store.ledger.filter(r => r.kind === 'debit').length, 1);
  }

  // Concurrency: two simultaneous reserves against a 1-credit balance ⇒
  // exactly one succeeds.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 1, 0);
    const [a, b] = await Promise.all([
      reserveCredit('100', 'race-1', 'link', freeUser(1, 0), { rpc: store }),
      reserveCredit('100', 'race-2', 'link', freeUser(1, 0), { rpc: store })
    ]);
    assert.equal([a, b].filter(r => r !== null).length, 1);
    assert.deepEqual(store.balance('100'), { daily: 0, permanent: 0 });
    assert.equal(store.ledger.filter(r => r.kind === 'debit').length, 1);
  }

  // Inconclusive scan path: reserve then release ⇒ balance restored and
  // the ledger holds exactly one debit and one refund. A second release
  // is a no-op.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 1, 0);
    const res = await reserveCredit('100', 'k1', 'link', freeUser(1, 0), { rpc: store });
    assert.ok(res);
    await releaseCredit('100', res, 'inconclusive', { rpc: store });
    assert.deepEqual(store.balance('100'), { daily: 1, permanent: 0 });
    assert.deepEqual(store.ledger.map(r => r.kind), ['debit', 'refund']);
    await releaseCredit('100', res, 'inconclusive', { rpc: store });
    assert.equal(store.ledger.filter(r => r.kind === 'refund').length, 1);
    assert.deepEqual(store.balance('100'), { daily: 1, permanent: 0 });
  }

  // Settled reservations are final: a later release cannot refund them.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 1, 0);
    const res = await reserveCredit('100', 'k1', 'link', freeUser(1, 0), { rpc: store });
    assert.ok(res);
    await settleCredit('100', res, { rpc: store });
    await releaseCredit('100', res, 'late_failure', { rpc: store });
    assert.deepEqual(store.balance('100'), { daily: 0, permanent: 0 });
    assert.equal(store.ledger.filter(r => r.kind === 'refund').length, 0);
  }

  // Retry of a released request with the same key reserves again (the
  // refund was real, so the retry pays again — exactly once).
  {
    const store = new FakeCreditStore();
    store.addUser('100', 1, 0);
    const first = await reserveCredit('100', 'retry-key', 'link', freeUser(1, 0), { rpc: store });
    await releaseCredit('100', first, 'inconclusive', { rpc: store });
    const second = await reserveCredit('100', 'retry-key', 'link', freeUser(1, 0), { rpc: store });
    assert.equal(second?.source, 'daily');
    assert.equal(second?.duplicate, undefined);
    assert.deepEqual(store.balance('100'), { daily: 0, permanent: 0 });
    assert.deepEqual(store.ledger.map(r => r.kind), ['debit', 'refund', 'debit']);
  }

  // Owner and premium bypass: no RPC call, nothing to settle or release.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 0, 0);
    const owner = await reserveCredit('100', 'k1', 'link', { ...freeUser(0, 0), role: 'owner' }, { rpc: store });
    assert.equal(owner?.source, 'owner');
    const premium = await reserveCredit('100', 'k2', 'link', {
      ...freeUser(0, 0),
      plan: 'ind_monthly',
      premium_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }, { rpc: store });
    assert.equal(premium?.source, 'premium');
    assert.equal(store.rpcCalls.length, 0);
  }

  // Expired premium is not a bypass: the RPC path runs.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 1, 0);
    const res = await reserveCredit('100', 'k1', 'link', {
      ...freeUser(1, 0),
      plan: 'ind_monthly',
      premium_until: new Date(Date.now() - 60 * 1000).toISOString()
    }, { rpc: store });
    assert.equal(res?.source, 'daily');
    assert.equal(store.rpcCalls.length, 1);
  }

  // Missing-function error ⇒ legacy fallback runs (and only then).
  {
    const store = new FakeCreditStore();
    store.addUser('100', 0, 4);
    store.forcedError = { code: 'PGRST202', message: 'Could not find the function public.reserve_credit in the schema cache' };
    let legacyCalls = 0;
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };
    try {
      const res = await reserveCredit('100', 'k1', 'link', freeUser(0, 4), {
        rpc: store,
        legacyConsume: async () => {
          legacyCalls += 1;
          return 'permanent';
        }
      });
      assert.equal(res?.source, 'permanent');
      assert.equal(res?.legacy, true);
      assert.equal(res?.idempotencyKey, null);
      assert.equal(legacyCalls, 1);
      assert.ok(errors.some(e => e.includes('legacy non-atomic')));
      // Settle/release on a legacy reservation must not call the RPC.
      const callsBefore = store.rpcCalls.length;
      await settleCredit('100', res, { rpc: store });
      await releaseCredit('100', res, 'inconclusive', { rpc: store });
      assert.equal(store.rpcCalls.length, callsBefore);
    } finally {
      console.error = origError;
    }
  }

  // Any other RPC error ⇒ fail closed (no reservation), no fallback.
  {
    const store = new FakeCreditStore();
    store.addUser('100', 3, 3);
    store.forcedError = { code: 'XX000', message: 'internal error' };
    let legacyCalls = 0;
    const origError = console.error;
    console.error = () => {};
    try {
      const res = await reserveCredit('100', 'k1', 'link', freeUser(3, 3), {
        rpc: store,
        legacyConsume: async () => {
          legacyCalls += 1;
          return 'daily';
        }
      });
      assert.equal(res, null);
      assert.equal(legacyCalls, 0);
    } finally {
      console.error = origError;
    }
  }

  // Missing-function detection is narrow.
  assert.equal(isMissingCreditFunctionError({ code: 'PGRST202', message: 'x' }), true);
  assert.equal(isMissingCreditFunctionError({ code: '42883', message: 'x' }), true);
  assert.equal(
    isMissingCreditFunctionError({ message: 'function public.reserve_credit(text, text, text) does not exist' }),
    true
  );
  assert.equal(isMissingCreditFunctionError({ code: '23505', message: 'duplicate key' }), false);
  assert.equal(isMissingCreditFunctionError({ message: 'connection reset' }), false);

  console.log('Atomic credit reserve/settle/release assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
