import assert from 'node:assert/strict';

// The services build a Supabase client at import time; give them harmless
// dummy values so the modules load without real credentials. Every test
// injects a fake client, so nothing here touches the network or a database.
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { flagUser } = require('../src/services/abuseDetection') as typeof import('../src/services/abuseDetection');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkAbuseAndEnforce } = require('../src/services/abuseEnforcement') as typeof import('../src/services/abuseEnforcement');

type SupabaseLike = import('../src/services/abuseDetection').SupabaseLike;

interface RecordedCall {
  table: string;
  op: 'insert' | 'select' | 'update';
  payload?: any;
}

interface FakeBehavior {
  flagInsertError?: unknown;
  /** abuse_flags counts in await order: [total, today, week]. */
  counts?: [number, number, number];
  countError?: unknown;
  user?: Record<string, unknown> | null;
  userError?: unknown;
  updateError?: unknown;
  /**
   * Simulates a concurrent enforcement call having banned the user after
   * this call read them: conditional updates match no row and return an
   * empty data array (with .select('id') chained), like PostgREST.
   */
  updateSuperseded?: boolean;
  admin?: { id: string } | null;
  adminError?: unknown;
  auditInsertError?: unknown;
}

/**
 * Minimal thenable query-builder fake covering exactly the call shapes the
 * abuse services use: insert(...), select(...).eq()/gt(), update(...).eq(),
 * and .single(). Every awaited operation is recorded in `calls`.
 */
class FakeQuery implements PromiseLike<any> {
  private op: 'insert' | 'select' | 'update' | null = null;
  private payload: any;
  private eqFields: string[] = [];

  constructor(
    private table: string,
    private behavior: FakeBehavior,
    private calls: RecordedCall[],
    private state: { flagSelects: number }
  ) {}

  insert(payload: any): this {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  select(): this {
    // .select('id') chained after .update() is a RETURNING clause, not a
    // new operation; only a leading select() starts a read.
    if (this.op !== 'update') {
      this.op = 'select';
    }
    return this;
  }

  update(payload: any): this {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  eq(field: string): this {
    this.eqFields.push(field);
    return this;
  }

  gt(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  single(): Promise<any> {
    this.calls.push({ table: this.table, op: 'select', payload: this.payload });
    if (this.table === 'users' && this.eqFields.includes('role')) {
      if (this.behavior.adminError) {
        return Promise.resolve({ data: null, error: this.behavior.adminError });
      }
      return Promise.resolve({ data: this.behavior.admin ?? null, error: null });
    }
    if (this.table === 'users') {
      return Promise.resolve({
        data: this.behavior.user ?? null,
        error: this.behavior.userError ?? null
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  private resolveAwait(): any {
    this.calls.push({ table: this.table, op: this.op as RecordedCall['op'], payload: this.payload });
    if (this.op === 'insert' && this.table === 'abuse_flags') {
      return { error: this.behavior.flagInsertError ?? null };
    }
    if (this.op === 'insert' && this.table === 'admin_logs') {
      return { error: this.behavior.auditInsertError ?? null };
    }
    if (this.op === 'select' && this.table === 'abuse_flags') {
      const counts = this.behavior.counts ?? [0, 0, 0];
      const idx = Math.min(this.state.flagSelects, counts.length - 1);
      this.state.flagSelects += 1;
      return { count: counts[idx], error: this.behavior.countError ?? null };
    }
    if (this.op === 'update' && this.table === 'users') {
      if (this.behavior.updateError) {
        return { data: null, error: this.behavior.updateError };
      }
      // A conditional update that matched no row (concurrent ban landed
      // first) returns an empty array; a landed update returns the row.
      return { data: this.behavior.updateSuperseded ? [] : [{ id: 'row' }], error: null };
    }
    return { error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.resolveAwait())
      .then(onfulfilled, onrejected);
  }
}

function makeFakeClient(behavior: FakeBehavior): { client: SupabaseLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const state = { flagSelects: 0 };
  const client = {
    from: (table: string) => new FakeQuery(table, behavior, calls, state)
  };
  return { client: client as unknown as SupabaseLike, calls };
}

/** Capture console.error / console.log output for assertions. */
function captureConsole() {
  const errors: string[] = [];
  const logs: string[] = [];
  const origError = console.error;
  const origLog = console.log;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  return {
    errors,
    logs,
    restore() {
      console.error = origError;
      console.log = origLog;
    }
  };
}

const USER_ID = '00000000-0000-0000-0000-0000000000aa';
const ACTIVE_USER = { id: USER_ID, is_banned: false };
const OWNER = { id: '00000000-0000-0000-0000-0000000000bb' };

async function run(): Promise<void> {
  // #414: flag insert fails ⇒ failure is logged, enforcement never runs
  // (no flag counts are read, no user update is attempted).
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        flagInsertError: { message: 'insert denied' },
        counts: [10, 10, 10],
        user: ACTIVE_USER,
        admin: OWNER
      });
      await flagUser(USER_ID, 'spam', {}, client);
      assert.equal(calls.filter(c => c.table === 'abuse_flags' && c.op === 'select').length, 0);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 0);
      assert.ok(cap.errors.some(e => e.includes('Failed to record abuse flag')));
    } finally {
      cap.restore();
    }
  }

  // Happy path: flag persists, throttle threshold met, the throttle write
  // succeeds, exactly one audit entry is written, action is reported.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [3, 3, 3],
        user: ACTIVE_USER,
        admin: OWNER
      });
      await flagUser(USER_ID, 'rate_limit_exceeded', {}, client);
      const updates = calls.filter(c => c.table === 'users' && c.op === 'update');
      assert.equal(updates.length, 1);
      assert.equal(updates[0].payload.is_throttled, true);
      const audits = calls.filter(c => c.table === 'admin_logs' && c.op === 'insert');
      assert.equal(audits.length, 1);
      assert.equal(audits[0].payload.action, 'AUTO_THROTTLE');
      assert.ok(cap.logs.some(l => l.includes('THROTTLE')));
    } finally {
      cap.restore();
    }
  }

  // #416: hard-ban write fails ⇒ explicit enforcement failure is logged,
  // no audit entry is written, and no success is reported.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [10, 10, 10],
        user: ACTIVE_USER,
        updateError: { message: 'update denied' },
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 1);
      assert.equal(calls.filter(c => c.table === 'admin_logs' && c.op === 'insert').length, 0);
      assert.ok(cap.errors.some(e => e.includes('ENFORCEMENT FAILURE') && e.includes('HARD_BAN')));
      assert.ok(!cap.logs.some(l => l.includes('HARD_BAN')));
    } finally {
      cap.restore();
    }
  }

  // Temp ban happy path: weekly threshold, ban write succeeds, audit once.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [7, 2, 7],
        user: ACTIVE_USER,
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      const updates = calls.filter(c => c.table === 'users' && c.op === 'update');
      assert.equal(updates.length, 1);
      assert.equal(updates[0].payload.is_banned, true);
      assert.ok(updates[0].payload.banned_until);
      const audits = calls.filter(c => c.table === 'admin_logs' && c.op === 'insert');
      assert.equal(audits.length, 1);
      assert.equal(audits[0].payload.action, 'AUTO_TEMP_BAN');
    } finally {
      cap.restore();
    }
  }

  // Audit write fails after a verified enforcement write: the failure is
  // logged distinctly; the action itself still stands (it did land).
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [3, 3, 3],
        user: ACTIVE_USER,
        admin: OWNER,
        auditInsertError: { message: 'audit denied' }
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 1);
      assert.ok(cap.errors.some(e => e.includes('Failed to write audit log')));
      assert.ok(cap.logs.some(l => l.includes('THROTTLE')));
    } finally {
      cap.restore();
    }
  }

  // Already-banned user: no enforcement write is attempted.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [10, 10, 10],
        user: { id: USER_ID, is_banned: true },
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 0);
    } finally {
      cap.restore();
    }
  }

  // #470 review (A1): the HARD_BAN write clears banned_until, so no
  // stale temp-ban expiry can ever unban a permanently banned user.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [10, 10, 10],
        user: ACTIVE_USER,
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      const updates = calls.filter(c => c.table === 'users' && c.op === 'update');
      assert.equal(updates.length, 1);
      assert.ok('banned_until' in updates[0].payload);
      assert.equal(updates[0].payload.banned_until, null);
      assert.equal(calls.filter(c => c.table === 'admin_logs' && c.op === 'insert').length, 1);
    } finally {
      cap.restore();
    }
  }

  // #470 review (A1): a TEMP_BAN whose conditional update matches no row
  // (a concurrent call banned the user first, possibly a HARD_BAN) is
  // superseded: it does not claim the action and writes no audit entry —
  // above all it must not stamp a banned_until over the existing ban.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [7, 2, 7],
        user: ACTIVE_USER,
        updateSuperseded: true,
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 1);
      assert.equal(calls.filter(c => c.table === 'admin_logs' && c.op === 'insert').length, 0);
      assert.ok(cap.logs.some(l => l.includes('TEMP_BAN') && l.includes('superseded')));
      assert.ok(!cap.logs.some(l => l.includes('-> TEMP_BAN')));
    } finally {
      cap.restore();
    }
  }

  // #470 review (A1): same supersede behaviour for a THROTTLE racing a
  // concurrent ban.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [3, 3, 3],
        user: ACTIVE_USER,
        updateSuperseded: true,
        admin: OWNER
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 1);
      assert.equal(calls.filter(c => c.table === 'admin_logs' && c.op === 'insert').length, 0);
      assert.ok(cap.logs.some(l => l.includes('THROTTLE') && l.includes('superseded')));
      assert.ok(!cap.logs.some(l => l.includes('-> THROTTLE')));
    } finally {
      cap.restore();
    }
  }

  // #470 review (A5): enforcement lands but no owner exists to attribute
  // the audit entry: the gap is reported loudly instead of passing
  // silently, and the action itself still stands.
  {
    const cap = captureConsole();
    try {
      const { client, calls } = makeFakeClient({
        counts: [3, 3, 3],
        user: ACTIVE_USER,
        admin: null
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.equal(calls.filter(c => c.table === 'users' && c.op === 'update').length, 1);
      assert.equal(calls.filter(c => c.table === 'admin_logs' && c.op === 'insert').length, 0);
      assert.ok(cap.errors.some(e => e.includes('could not be audited')));
      assert.ok(cap.logs.some(l => l.includes('THROTTLE')));
    } finally {
      cap.restore();
    }
  }

  // #470 review (A5): a failed owner lookup is reported the same way.
  {
    const cap = captureConsole();
    try {
      const { client } = makeFakeClient({
        counts: [3, 3, 3],
        user: ACTIVE_USER,
        adminError: { message: 'lookup failed' }
      });
      await checkAbuseAndEnforce(USER_ID, client);
      assert.ok(cap.errors.some(e => e.includes('could not be audited')));
    } finally {
      cap.restore();
    }
  }

  // #470 review (A2): the /simulate_abuse handler in index.ts checks the
  // simulated-flag insert result before running enforcement. Source-level
  // assertion, matching the repo's existing source-test precedent (the
  // bot entry point cannot be unit-tested in-process).
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('node:path');
    const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
    const start = indexSource.indexOf("bot.command('simulate_abuse'");
    assert.notEqual(start, -1);
    const block = indexSource.slice(start, indexSource.indexOf("bot.command('simulate_abuse_reset'", start));
    const insertCheck = block.indexOf('const { error: insertError } = await supabase.from(\'abuse_flags\').insert(rows)');
    assert.notEqual(insertCheck, -1, 'simulate_abuse must destructure the insert error');
    const enforceCall = block.indexOf('await checkAbuseAndEnforce(target.id)');
    assert.ok(insertCheck < enforceCall, 'insert must be checked before enforcement runs');
    assert.ok(block.includes('Simulation failed'), 'handler must report failure instead of success');
  }

  console.log('Abuse flag & enforcement error-checking assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
