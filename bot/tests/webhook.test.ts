import assert from 'node:assert/strict';
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

// In-memory processed_updates store implementing the status machine.
function fakeDb(initial?: Map<number, { status: string; started_at: string; claim_token?: string; reply_phase?: string | null }>) {
  const rows = initial ?? new Map<number, { status: string; started_at: string; claim_token?: string; reply_phase?: string | null }>();
  const calls = { inserted: [] as number[], statusUpdates: [] as any[], failInsert: null as any };
  return {
    rows, calls,
    from(table: string) {
      assert.equal(table, 'processed_updates');
      return {
        async insert(row: any) {
          if (calls.failInsert) return { error: calls.failInsert };
          if (rows.has(row.update_id)) return { error: { code: '23505' } };
          calls.inserted.push(row.update_id);
          rows.set(row.update_id, { status: row.status, started_at: row.started_at, claim_token: row.claim_token });
          return { error: null };
        },
        update(patch: any) {
          const filters: Record<string, any> = {};
          const applyUpdate = () => {
            const id = filters['update_id'];
            // optimistic-claim guard: row must still match all filters
            const cur = rows.get(id);
            const matches = cur && Object.entries(filters).every(([k, v]) => (cur as any)[k] === v || k === 'update_id');
            if (matches) {
              calls.statusUpdates.push({ id, ...patch });
              rows.set(id, { ...cur, ...patch });
              return [{ update_id: id, ...rows.get(id) }];
            }
            return [];
          };
          const q: any = {
            eq(col: string, val: any) { filters[col] = val; return q; },
            select(_cols: string) { const data = applyUpdate(); return Promise.resolve({ data, error: null }); },
            then(resolve: any) { applyUpdate(); resolve({ error: null }); }
          };
          return q;
        },
        select(_cols: string) {
          return {
            eq(_c: string, id: number) {
              return {
                async single() {
                  const cur = rows.get(id);
                  return cur
                    ? { data: { update_id: id, ...cur }, error: null }
                    : { data: null, error: { code: 'PGRST116' } };
                }
              };
            }
          };
        }
      };
    }
  };
}

function fakeBot(opts: { throwOnHandle?: boolean } = {}) {
  const calls: number[] = [];
  return {
    calls, inited: false,
    async init(this: any) { this.inited = true; },
    async handleUpdate(this: any, u: { update_id: number }) {
      if (!this.inited) throw new Error('Bot not initialized!');
      calls.push(u.update_id);
      if (opts.throwOnHandle) throw new Error('boom');
    }
  };
}

const SECRET = 's3cret';
const auth = { 'x-telegram-bot-api-secret-token': SECRET };

async function main() {
  // 1. Secret unset -> fail closed (401), no effects
  {
    const db = fakeDb(); const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: undefined });
    const r = fakeRes();
    await h({ headers: {}, body: { update_id: 1 } }, r);
    assert.equal(r.statusCode, 401);
    assert.deepEqual(db.calls.inserted, []);
    assert.deepEqual(bot.calls, []);
  }
  // 2. Wrong secret -> 401
  {
    const db = fakeDb(); const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: { update_id: 1 } }, r);
    assert.equal(r.statusCode, 401);
    assert.deepEqual(bot.calls, []);
  }
  // 3. Malformed bodies -> 200 ack, no processing
  {
    const db = fakeDb(); const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    for (const body of [null, undefined, {}, { update_id: '42' }, { update_id: -1 }, { update_id: 1.5 }, 'x']) {
      const r = fakeRes();
      await h({ headers: auth, body }, r);
      assert.equal(r.statusCode, 200, JSON.stringify(body));
    }
    assert.deepEqual(bot.calls, []);
    assert.deepEqual(db.calls.inserted, []);
  }
  // 4. First delivery -> insert + process + mark done + 200
  {
    const db = fakeDb(); const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 42 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(db.calls.inserted, [42]);
    assert.deepEqual(bot.calls, [42]);
    assert.equal(db.rows.get(42)?.status, 'done');
  }
  // 5. Duplicate of a done update -> 200, no reprocessing
  {
    const db = fakeDb(new Map([[42, { status: 'done', started_at: new Date().toISOString() }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 42 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, []);
  }
  // 6. Duplicate while processing is fresh -> 500 (Telegram retries later; a
  //    200 here could lose the update forever if the in-flight worker dies)
  {
    const db = fakeDb(new Map([[7, { status: 'processing', started_at: new Date().toISOString() }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 7 } }, r);
    assert.equal(r.statusCode, 500);
    assert.deepEqual(bot.calls, []);
  }
  // 6b. Takeover claim loses the race (row changed between read and claim) ->
  //     500 (stay retriable): the winner's completion is unconfirmed, and a
  //     200 here could strand the update if the winner dies. No double processing.
  {
    // pre-seed as failed; the fake applies the guarded update only when the
    // row still matches, so simulate the race by pre-winning the claim
    const db = fakeDb(new Map([[12, { status: 'processing', started_at: new Date().toISOString() }]]));
    // force the read to observe a 'failed' row while the claim will see 'processing'
    const origSelect = db.from('processed_updates').select;
    let readOnce = false;
    const wrappedFrom = db.from.bind(db);
    db.from = (table: string) => {
      const q: any = wrappedFrom(table);
      const sel = q.select;
      q.select = (cols: string) => ({
        eq: (_c: string, _id: number) => ({
          single: async () => readOnce
            ? { data: null, error: { code: 'x' } }
            : (readOnce = true, { data: { update_id: 12, status: 'failed', started_at: new Date().toISOString() }, error: null })
        })
      });
      return q;
    };
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET, takeoverAfterMs: 0 });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 12 } }, r);
    assert.equal(r.statusCode, 500);
    assert.deepEqual(bot.calls, []);
  }
  // 7. Stale processing (crashed invocation) -> takeover and reprocess
  {
    const db = fakeDb(new Map([[8, { status: 'processing', started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET, takeoverAfterMs: 5 * 60 * 1000 });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 8 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, [8]);
    assert.equal(db.rows.get(8)?.status, 'done');
  }
  // 8. Failed update (Telegram retry) -> reprocess
  {
    const db = fakeDb(new Map([[9, { status: 'failed', started_at: new Date().toISOString() }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 9 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, [9]);
  }
  // 9. Dedupe store error on insert -> 500 (Telegram retries), no processing
  {
    const db = fakeDb(); db.calls.failInsert = { code: '53300' };
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 10 } }, r);
    assert.equal(r.statusCode, 500);
    assert.deepEqual(bot.calls, []);
  }
  // 10. Handler throws -> status failed + 500
  {
    const db = fakeDb(); const bot = fakeBot({ throwOnHandle: true });
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 11 } }, r);
    assert.equal(r.statusCode, 500);
    assert.equal(db.rows.get(11)?.status, 'failed');
  }
  // 12. Uniform response rule: ambiguous terminal state acks without effects
  {
    const db = fakeDb(new Map([[20, { status: 'ambiguous', started_at: new Date().toISOString() }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 20 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, []);
    assert.equal(db.rows.get(20)?.status, 'ambiguous');
  }
  // 13. reply_phase 'replied' on a failed row: work completed, only the done
  //     marker is missing -> converge to done, no reprocessing
  {
    const db = fakeDb(new Map([[21, { status: 'failed', started_at: new Date().toISOString(), reply_phase: 'replied' }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 21 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, []);
    assert.equal(db.rows.get(21)?.status, 'done');
  }
  // 14. reply_phase 'replying' on a failed row: the result reply may have been
  //     sent -> stop as ambiguous (ack, NO reprocessing, never replay reply)
  {
    const db = fakeDb(new Map([[22, { status: 'failed', started_at: new Date().toISOString(), reply_phase: 'replying' }]]));
    const bot = fakeBot();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 22 } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(bot.calls, []);
    assert.equal(db.rows.get(22)?.status, 'ambiguous');
  }
  // 15. AmbiguousOperationError from the handler -> status 'ambiguous' + 200 ack
  {
    const db = fakeDb();
    const bot = fakeBot();
    const { AmbiguousOperationError } = require('../src/errors');
    bot.handleUpdate = async function (this: any) { this.inited = true; throw new AmbiguousOperationError('provider spend uncertain'); };
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 23 } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(db.rows.get(23)?.status, 'ambiguous');
  }
  // 16. Done-write that matches 0 rows (claim lost mid-work) -> 500, NOT 200:
  //     completion was never durably confirmed.
  {
    const db = fakeDb();
    const bot = fakeBot();
    const origFrom = db.from.bind(db);
    let doneWrite = false;
    db.from = (table: string) => {
      const q: any = origFrom(table);
      const upd = q.update;
      q.update = (patch: any) => {
        if (patch.status === 'done') doneWrite = true;
        const qq = upd(patch);
        if (patch.status === 'done') {
          // simulate the claim disappearing before the done write
          qq.select = async () => ({ data: [], error: null });
        }
        return qq;
      };
      return q;
    };
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 24 } }, r);
    assert.equal(doneWrite, true);
    assert.equal(r.statusCode, 500);
  }
  // 17. Watchdog: a hung handler is aborted; delivery ends 500 + failed, and
  //     the aborted work settles within the grace period.
  {
    const db = fakeDb();
    const bot = fakeBot();
    bot.handleUpdate = async function (this: any, u: any) {
      this.inited = true;
      const signal = u.__ntf?.signal;
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 60_000);
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
      });
    };
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET, watchdogMs: 200, settleGraceMs: 2000 });
    const r = fakeRes();
    const start = Date.now();
    await h({ headers: auth, body: { update_id: 25 } }, r);
    const elapsed = Date.now() - start;
    assert.equal(r.statusCode, 500);
    assert.equal(db.rows.get(25)?.status, 'failed');
    assert.ok(elapsed < 3000, `watchdog should terminate the delivery, took ${elapsed}ms`);
  }
  // 11. Real grammy Bot: handler must call bot.init() before handleUpdate.
  //     API calls are intercepted by a transformer - no network involved.
  {
    const { Bot } = require('grammy');
    const bot = new Bot('fake-token-for-init-test');
    const handled: number[] = [];
    bot.api.config.use(async (_prev: any, method: string) => {
      if (method === 'getMe') return { ok: true, result: { id: 1, is_bot: true, first_name: 'testbot', username: 'testbot' } };
      return { ok: true, result: true };
    });
    bot.on('message', async (ctx: any) => { handled.push(ctx.update.update_id); });
    const db = fakeDb();
    const h = createTelegramWebhookHandler({ bot, supabase: db, secretToken: SECRET });
    const r = fakeRes();
    await h({ headers: auth, body: { update_id: 100, message: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, from: { id: 1, is_bot: false, first_name: 'u' } } } }, r);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(handled, [100]);
    assert.equal(bot.botInfo.username, 'testbot');
  }
  console.log('webhook handler assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
