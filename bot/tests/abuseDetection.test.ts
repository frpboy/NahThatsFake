import assert from 'node:assert/strict';
import { recordAbuseFlag } from '../src/services/abuseDetectionCore';

async function run() {
  let enforcementCalls = 0;
  const events: Array<{ event: string; code?: string }> = [];

  const success = await recordAbuseFlag('user-1', 'spam', { sample: true }, {
    insertFlag: async () => ({ error: null }),
    enforce: async () => { enforcementCalls += 1; },
    logError: (event, code) => events.push({ event, code })
  });
  assert.deepEqual(success, { recorded: true, enforcement: 'completed' });
  assert.equal(enforcementCalls, 1);

  const returnedError = await recordAbuseFlag('user-2', 'spam', { private: 'do-not-log' }, {
    insertFlag: async () => ({ error: { code: '42501' } }),
    enforce: async () => { enforcementCalls += 1; },
    logError: (event, code) => events.push({ event, code })
  });
  assert.deepEqual(returnedError, { recorded: false, enforcement: 'skipped', reason: 'insert_failed' });
  assert.equal(enforcementCalls, 1);
  assert.deepEqual(events.at(-1), { event: 'insert_failed', code: '42501' });

  const transportError = await recordAbuseFlag('user-3', 'spam', {}, {
    insertFlag: async () => { throw new Error('synthetic transport failure'); },
    enforce: async () => { enforcementCalls += 1; },
    logError: (event, code) => events.push({ event, code })
  });
  assert.deepEqual(transportError, { recorded: false, enforcement: 'skipped', reason: 'insert_failed' });
  assert.equal(enforcementCalls, 1);
  assert.deepEqual(events.at(-1), { event: 'insert_failed', code: 'transport_error' });

  console.log('abuse flag persistence assertions passed');
}

void run();
