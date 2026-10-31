import assert from 'node:assert/strict';
import { persistEnforcementWrite, type AbuseEnforcementAction } from '../src/services/abuseEnforcementCore';

async function run() {
  const actions: AbuseEnforcementAction[] = ['HARD_BAN', 'TEMP_BAN', 'THROTTLE'];

  for (const action of actions) {
    const failures: Array<{ action: AbuseEnforcementAction; code: string }> = [];
    const succeeded = await persistEnforcementWrite(
      action,
      async () => ({ data: { id: 'synthetic-user' }, error: null }),
      (failedAction, code) => failures.push({ action: failedAction, code }),
    );

    assert.equal(succeeded, true, action + ' must be accepted only after an updated row is returned.');
    assert.deepEqual(failures, []);
  }

  for (const action of actions) {
    const failures: Array<{ action: AbuseEnforcementAction; code: string }> = [];
    const persisted = await persistEnforcementWrite(
      action,
      async () => ({
        data: null,
        error: { code: '42501', message: 'synthetic private database detail must not escape' } as { code: string },
      }),
      (failedAction, code) => failures.push({ action: failedAction, code }),
    );

    assert.equal(persisted, false, action + ' must fail closed when Supabase returns an update error.');
    assert.deepEqual(failures, [{ action, code: '42501' }]);
    assert.equal(JSON.stringify(failures).includes('synthetic private database detail'), false,
      'Failure reporting must not include raw database messages.');
  }

  const missingRowFailures: Array<{ action: AbuseEnforcementAction; code: string }> = [];
  const missingRowPersisted = await persistEnforcementWrite(
    'HARD_BAN',
    async () => ({ data: null, error: null }),
    (action, code) => missingRowFailures.push({ action, code }),
  );
  assert.equal(missingRowPersisted, false, 'A zero-row update must not be reported as a persisted enforcement action.');
  assert.deepEqual(missingRowFailures, [{ action: 'HARD_BAN', code: 'no_row_updated' }]);

  const transportFailures: Array<{ action: AbuseEnforcementAction; code: string }> = [];
  const transportPersisted = await persistEnforcementWrite(
    'THROTTLE',
    async () => { throw new Error('synthetic transport failure'); },
    (action, code) => transportFailures.push({ action, code }),
  );
  assert.equal(transportPersisted, false, 'A rejected update request must not be reported as successful.');
  assert.deepEqual(transportFailures, [{ action: 'THROTTLE', code: 'transport_error' }]);

  console.log('abuse enforcement persistence assertions passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
