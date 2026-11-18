import assert from 'node:assert/strict';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyLazyDailyReset } = require('../src/utils/credits');

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// Fake supabase client: simulates the conditional update + re-read behavior.
function fakeClient(opts: { rowsUpdated: number; freshRow?: any }) {
  const tracked = { updated: [] as any[], rereads: 0 };
  return {
    tracked,
    from(table: string) {
      assert.equal(table, 'users');
      return {
        update(payload: any) {
          tracked.updated.push(payload);
          const q: any = {
            eq() { return q; },
            is() { return q; },
            select(_cols: string) {
              return Promise.resolve({
                data: opts.rowsUpdated > 0 ? [{ daily_credits: payload.daily_credits, daily_credits_date: payload.daily_credits_date }] : [],
                error: null
              });
            }
          };
          return q;
        },
        select(_cols: string) {
          return {
            eq() {
              return {
                async single() { return { data: opts.freshRow ?? null, error: opts.freshRow ? null : { code: 'x' } }; }
              };
            }
          };
        }
      };
    }
  };
}

async function main() {
  // Free user, stale date -> reset applied and confirmed by the returned row
  {
    const c = fakeClient({ rowsUpdated: 1 });
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: '2000-01-01' }, c);
    assert.equal(u.daily_credits, 3);
    assert.equal(u.daily_credits_date, todayIST());
    assert.equal(c.tracked.updated.length, 1);
  }
  // Free user, already reset today -> untouched
  {
    const c = fakeClient({ rowsUpdated: 0 });
    const u = await applyLazyDailyReset('111', { daily_credits: 1, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: todayIST() }, c);
    assert.equal(u.daily_credits, 1);
    assert.equal(c.tracked.updated.length, 0);
  }
  // Premium ACTIVE -> untouched even with stale date
  {
    const c = fakeClient({ rowsUpdated: 0 });
    const future = new Date(Date.now() + 86400000).toISOString();
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 5, plan: 'ind_monthly', premium_until: future, role: 'user', daily_credits_date: '2000-01-01' }, c);
    assert.equal(u.daily_credits, 0);
    assert.equal(c.tracked.updated.length, 0);
  }
  // Premium EXPIRED -> treated as free, daily credits reset
  {
    const c = fakeClient({ rowsUpdated: 1 });
    const past = new Date(Date.now() - 86400000).toISOString();
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 5, plan: 'ind_monthly', premium_until: past, role: 'user', daily_credits_date: '2000-01-01' }, c);
    assert.equal(u.daily_credits, 3);
    assert.equal(c.tracked.updated.length, 1);
  }
  // Zero-row update (concurrent change) -> re-read fresh row, NEVER fabricate 3
  {
    const fresh = { daily_credits: 2, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: todayIST() };
    const c = fakeClient({ rowsUpdated: 0, freshRow: fresh });
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: '2000-01-01' }, c);
    assert.equal(u.daily_credits, 2);
    assert.equal(u.daily_credits_date, todayIST());
  }
  // Zero-row update AND failed re-read -> keep observed row (no fabrication)
  {
    const c = fakeClient({ rowsUpdated: 0, freshRow: null });
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: '2000-01-01' }, c);
    assert.equal(u.daily_credits, 0);
  }
  console.log('credits lazy-reset assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
