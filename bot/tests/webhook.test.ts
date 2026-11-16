import assert from 'node:assert/strict';
// Env must exist before requiring modules that build the Supabase client.
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createTelegramWebhookHandler } = require('../src/webhook');

function fakeRes() {
  const r = { statusCode: 0, ended: false,
    status(code: number) { r.statusCode = code; return { end() { r.ended = true; } }; } };
  return r;
}

function fakeSupabase(behavior: { insertError?: any; deleteError?: any }) {
  const calls = { inserted: [] as number[], deleted: [] as number[] };
  return {
    calls,
    from(table: string) {
      assert.equal(table, 'processed_updates');
      return {
        async insert(row: { update_id: number }) {
          calls.inserted.push(row.update_id);
          return { error: behavior.insertError ?? null };
        },
        delete() {
          return {
            async eq(_col: string, val: number) {
              calls.deleted.push(val);
              return { error: behavior.deleteError ?? null };
            }
          };
        }
      };
    }
  };
}

function fakeBot(throwOnHandle = false) {
  const calls: number[] = [];
  return { calls, async handleUpdate(u: { update_id: number }) { calls.push(u.update_id); if (throwOnHandle) throw new Error('boom'); } };
}

async function main() {
  // 1. Wrong/missing secret -> 401, nothing else happens
  {
    const sb = fakeSupabase({});
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: { update_id: 1 } }, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(sb.calls.inserted, []);
    assert.deepEqual(bot.calls, []);
  }
  // 2. Correct secret -> processed
  {
    const sb = fakeSupabase({});
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: { update_id: 42 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sb.calls.inserted, [42]);
    assert.deepEqual(bot.calls, [42]);
  }
  // 3. No secret configured -> still processed (dev mode), warn only
  {
    const sb = fakeSupabase({});
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb });
    const res = fakeRes();
    await h({ headers: {}, body: { update_id: 7 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(bot.calls, [7]);
  }
  // 4. Malformed body -> 200 ack, no processing
  {
    const sb = fakeSupabase({});
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sb.calls.inserted, []);
  }
  // 5. Duplicate update_id (unique violation) -> 200 ack, NOT reprocessed
  {
    const sb = fakeSupabase({ insertError: { code: '23505', message: 'duplicate key' } });
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: { update_id: 42 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(bot.calls, []);
  }
  // 6. Dedupe DB error -> 500 (Telegram will retry), NOT processed
  {
    const sb = fakeSupabase({ insertError: { code: '53300', message: 'db down' } });
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: { update_id: 9 } }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(bot.calls, []);
  }
  // 7. Processing throws -> dedupe marker cleared + 500 so Telegram retries
  {
    const sb = fakeSupabase({});
    const bot = fakeBot(true);
    const h = createTelegramWebhookHandler({ bot, supabase: sb, secretToken: 's3cret' });
    const res = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: { update_id: 11 } }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(sb.calls.deleted, [11]);
  }
  console.log('webhook handler assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
