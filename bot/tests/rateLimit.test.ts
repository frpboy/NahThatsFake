import assert from 'node:assert/strict';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
process.env.OWNER_TELEGRAM_ID = '999';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRateLimitMiddleware } = require('../src/middleware/rateLimit');

function fakeSupabase(rpcResult: { data?: any; error?: any }) {
  const calls = { rpc: 0, rpcArgs: null as any };
  return {
    calls,
    rpc(name: string, args: any) {
      assert.equal(name, 'rate_limit_hit');
      calls.rpc++;
      calls.rpcArgs = args;
      return Promise.resolve(rpcResult);
    },
    from() { throw new Error('unexpected from()'); }
  };
}

function ctx(userId: number, updateId = 555) {
  const replies: string[] = [];
  return { from: { id: userId }, update: { update_id: updateId }, replies,
    reply: async (t: string) => { replies.push(t); } };
}

async function main() {
  // Under limit -> next() called, update_id passed for dedupe
  {
    const sb = fakeSupabase({ data: 3 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(123), async () => { proceeded = true; });
    assert.equal(proceeded, true);
    assert.equal(sb.calls.rpcArgs.p_update_id, 555);
  }
  // Over limit -> blocked silently (no next, no throw, no reply)
  {
    const sb = fakeSupabase({ data: 11 });
    const c = ctx(123);
    let proceeded = false;
    await createRateLimitMiddleware(sb)(c, async () => { proceeded = true; });
    assert.equal(proceeded, false);
    assert.equal(c.replies.length, 0);
  }
  // Owner bypass -> no rpc call
  {
    const sb = fakeSupabase({ data: 100 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(999), async () => { proceeded = true; });
    assert.equal(proceeded, true);
    assert.equal(sb.calls.rpc, 0);
  }
  // Counter store error -> transient failure: user notified once + THROWS so
  // the webhook marks the delivery failed/retriable (never silently dropped,
  // never marked done).
  {
    const sb = fakeSupabase({ error: { code: '53300' } });
    const c = ctx(123);
    let proceeded = false;
    let threw = false;
    try {
      await createRateLimitMiddleware(sb)(c, async () => { proceeded = true; });
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
    assert.equal(proceeded, false);
    assert.equal(c.replies.length, 1);
  }
  // Invalid counter values -> same transient failure path
  for (const bad of [null, undefined, 'x', -1, 1.5, Number.MAX_SAFE_INTEGER + 100]) {
    const sb = fakeSupabase({ data: bad });
    let threw = false;
    try {
      await createRateLimitMiddleware(sb)(ctx(123), async () => { /* must not run */ });
    } catch {
      threw = true;
    }
    assert.equal(threw, true, `value ${String(bad)} must be rejected`);
  }
  // Notice-reply failure must not mask the transient failure (still throws)
  {
    const sb = fakeSupabase({ error: { code: '53300' } });
    const c = ctx(123);
    c.reply = async () => { throw new Error('telegram down'); };
    let threw = false;
    try {
      await createRateLimitMiddleware(sb)(c, async () => { /* no-op */ });
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  }
  // No user on update (e.g. channel post) -> next
  {
    const sb = fakeSupabase({ data: 100 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)({}, async () => { proceeded = true; });
    assert.equal(proceeded, true);
  }
  console.log('rate limit assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
