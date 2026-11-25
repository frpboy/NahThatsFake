import assert from 'node:assert/strict';

// sightengine.ts builds a Supabase client at import time; give it harmless
// dummy values so the module loads without real credentials. The functions
// under test are pure and never touch the network or the database.
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  validateSightengineScores,
  interpretSightengineResult
} = require('../src/services/sightengine') as typeof import('../src/services/sightengine');

function run(): void {
  // Error status: never a verdict.
  assert.throws(
    () => validateSightengineScores({ status: 'error', scores: { synthetic: 0.1, human: 0.9 } }),
    /non-success/
  );
  assert.throws(
    () => interpretSightengineResult({ status: 'error', scores: { synthetic: 0.1, human: 0.9 } } as never),
    /non-success/
  );

  // Missing scores object: previously produced a fabricated LOW.
  assert.throws(() => validateSightengineScores({ status: 'success' }), /missing scores/);
  assert.throws(() => validateSightengineScores({ status: 'success', scores: null }), /missing scores/);
  assert.throws(() => validateSightengineScores(null), /invalid response/);
  assert.throws(() => validateSightengineScores('success'), /invalid response/);

  // Non-numeric / non-finite / out-of-range scores throw.
  assert.throws(
    () => validateSightengineScores({ status: 'success', scores: { synthetic: 'high', human: 0.5 } }),
    /"synthetic"/
  );
  assert.throws(
    () => validateSightengineScores({ status: 'success', scores: { synthetic: 0.5 } }),
    /"human"/
  );
  assert.throws(
    () => validateSightengineScores({ status: 'success', scores: { synthetic: Number.NaN, human: 0.5 } }),
    /"synthetic"/
  );
  assert.throws(
    () => validateSightengineScores({ status: 'success', scores: { synthetic: 1.4, human: 0.5 } }),
    /"synthetic"/
  );
  assert.throws(
    () => validateSightengineScores({ status: 'success', scores: { synthetic: -0.1, human: 0.5 } }),
    /"synthetic"/
  );

  // Valid responses validate and compute exactly as before.
  assert.deepEqual(
    validateSightengineScores({ status: 'success', scores: { synthetic: 0.2, human: 0.9 } }),
    { synthetic: 0.2, human: 0.9 }
  );

  const low = interpretSightengineResult({ status: 'success', scores: { synthetic: 0.2, human: 0.9 } } as never);
  assert.equal(low.score, 0.2);
  assert.equal(low.risk_level, 'LOW');
  assert.equal(low.confidence, 0.9);

  const medium = interpretSightengineResult({ status: 'success', scores: { synthetic: 0.5, human: 0.4 } } as never);
  assert.equal(medium.risk_level, 'MEDIUM');

  const high = interpretSightengineResult({ status: 'success', scores: { synthetic: 0.95, human: 0.1 } } as never);
  assert.equal(high.risk_level, 'HIGH');
  assert.equal(high.score, 0.95);

  console.log('Sightengine response validation assertions passed');
}

run();
