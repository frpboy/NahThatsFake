import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// sightengine.ts builds a Supabase client at import time; give it harmless
// dummy values so the module loads without real credentials. The functions
// under test are pure and never touch the network or the database.
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  validateSightengineScores,
  interpretSightengineResult,
  detectDeepfake
} = require('../src/services/sightengine') as typeof import('../src/services/sightengine');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios') as { post: unknown };

async function run(): Promise<void> {
  // Source-level request-shape pin, in the repo's source-test style: the
  // check.json call in sightengine.ts must request models genai and must
  // never again carry a workflow parameter (see the runtime pin below).
  const sightengineSource = fs.readFileSync(
    path.join(__dirname, '../src/services/sightengine.ts'),
    'utf8'
  );
  assert.ok(
    sightengineSource.includes("'models': 'genai'"),
    'sightengine check.json request must specify models genai'
  );
  assert.ok(
    !sightengineSource.includes("'workflow'"),
    'sightengine check.json request must not contain a workflow parameter'
  );

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

  // End-to-end through detectDeepfake() with a stubbed provider transport:
  // a response with missing scores must be rejected by detectDeepfake
  // itself, not just by the helpers (Sourcery test-gap finding on PR #465).
  process.env.SIGHTENGINE_API_KEY = process.env.SIGHTENGINE_API_KEY || 'test-user';
  process.env.SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET || 'test-secret';
  const originalPost = axios.post;
  try {
    axios.post = async () => ({ data: { status: 'success' } });
    await assert.rejects(detectDeepfake(Buffer.from('fake-image')), /missing scores/);

    axios.post = async () => ({ data: { status: 'error', scores: { synthetic: 0.1, human: 0.9 } } });
    await assert.rejects(detectDeepfake(Buffer.from('fake-image')), /non-success/);

    axios.post = async () => ({ data: { status: 'success', scores: { synthetic: 0.9, human: 0.2 } } });
    const verdict = await detectDeepfake(Buffer.from('fake-image'));
    assert.equal(verdict.risk_level, 'HIGH');
    assert.equal(verdict.score, 0.9);

    // Request shape pin (2026-11-28 live failure): detectDeepfake POSTs to
    // the plain check.json path, which rejects any request that also carries
    // a workflow id (Sightengine HTTP 400, argument_error code 2004:
    // "You specified a workflow id in your request but used a non-workflow
    // API path"). The payload must carry models=genai and NO workflow key.
    let capturedUrl: unknown;
    let capturedPayload: unknown;
    axios.post = async (url: unknown, payload: unknown) => {
      capturedUrl = url;
      capturedPayload = payload;
      return { data: { status: 'success', scores: { synthetic: 0.1, human: 0.9 } } };
    };
    await detectDeepfake(Buffer.from('fake-image'));
    assert.equal(capturedUrl, 'https://api.sightengine.com/1.0/check.json');
    const payload = capturedPayload as Record<string, unknown>;
    assert.equal(payload['models'], 'genai');
    assert.ok(!('workflow' in payload), 'check.json request must not contain a workflow parameter');
  } finally {
    axios.post = originalPost;
  }

  console.log('Sightengine response validation assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
