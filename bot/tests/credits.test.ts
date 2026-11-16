import assert from 'node:assert/strict';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyLazyDailyReset } = require('../src/utils/credits');

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function fakeClient(tracked: { updated: any[] }) {
  return {
    from(table: string) {
      assert.equal(table, 'users');
      return {
        update(payload: any) {
          tracked.updated.push(payload);
          const q: any = {
            eq() { return q; },
            is() { return q; },
            then(resolve: any) { resolve({ error: null }); }
          };
          return q;
        }
      };
    }
  };
}

async function main() {
  // Free user, stale date -> reset to 3 with today's date
  {
    const tracked = { updated: [] as any[] };
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: '2000-01-01' }, fakeClient(tracked));
    assert.equal(u.daily_credits, 3);
    assert.equal(u.daily_credits_date, todayIST());
    assert.equal(tracked.updated.length, 1);
  }
  // Free user, already reset today -> untouched
  {
    const tracked = { updated: [] as any[] };
    const u = await applyLazyDailyReset('111', { daily_credits: 1, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: todayIST() }, fakeClient(tracked));
    assert.equal(u.daily_credits, 1);
    assert.equal(tracked.updated.length, 0);
  }
  // Premium user -> untouched even with stale date
  {
    const tracked = { updated: [] as any[] };
    const future = new Date(Date.now() + 86400000).toISOString();
    const u = await applyLazyDailyReset('111', { daily_credits: 0, permanent_credits: 5, plan: 'ind_monthly', premium_until: future, role: 'user', daily_credits_date: '2000-01-01' }, fakeClient(tracked));
    assert.equal(u.daily_credits, 0);
    assert.equal(tracked.updated.length, 0);
  }
  // Free user, null date (pre-migration row) -> reset once
  {
    const tracked = { updated: [] as any[] };
    const u = await applyLazyDailyReset('111', { daily_credits: 2, permanent_credits: 0, plan: 'free', premium_until: null, role: 'user', daily_credits_date: null }, fakeClient(tracked));
    assert.equal(u.daily_credits, 3);
    assert.equal(tracked.updated.length, 1);
  }
  console.log('credits lazy-reset assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
