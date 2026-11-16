import assert from 'node:assert/strict';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
process.env.OWNER_TELEGRAM_ID = '999';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRateLimitMiddleware } = require('../src/middleware/rateLimit');

function fakeSupabase(rpcResult: { data?: any; error?: any }) {
  const calls = { rpc: 0 };
  return {
    calls,
    rpc(name: string, _args: any) {
      assert.equal(name, 'rate_limit_hit');
      calls.rpc++;
      return Promise.resolve(rpcResult);
    },
    from() { throw new Error('unexpected from()'); }
  };
}

function ctx(userId: number) {
  return { from: { id: userId } };
}

async function main() {
  // Under limit -> next() called
  {
    const sb = fakeSupabase({ data: 3 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(123), async () => { proceeded = true; });
    assert.equal(proceeded, true);
  }
  // Over limit -> blocked silently (no next)
  {
    const sb = fakeSupabase({ data: 11 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(123), async () => { proceeded = true; });
    assert.equal(proceeded, false);
  }
  // Owner bypass -> no rpc call
  {
    const sb = fakeSupabase({ data: 100 });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(999), async () => { proceeded = true; });
    assert.equal(proceeded, true);
    assert.equal(sb.calls.rpc, 0);
  }
  // Counter store error -> fail closed (enforcement invariant preserved)
  {
    const sb = fakeSupabase({ error: { code: '53300' } });
    let proceeded = false;
    await createRateLimitMiddleware(sb)(ctx(123), async () => { proceeded = true; });
    assert.equal(proceeded, false);
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
