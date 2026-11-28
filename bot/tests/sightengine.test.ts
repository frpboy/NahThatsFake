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
  // Source-level request-shape pins, in the repo's source-test style: the
  // check.json call in sightengine.ts must request models genai as a
  // multipart form field, must never again carry a workflow parameter, and
  // must not regress to a base64 field or a urlencoded Content-Type (see
  // the runtime pin below).
  const sightengineSource = fs.readFileSync(
    path.join(__dirname, '../src/services/sightengine.ts'),
    'utf8'
  );
  assert.ok(
    sightengineSource.includes("append('models', 'genai')"),
    'sightengine check.json request must specify models genai'
  );
  assert.ok(
    !sightengineSource.includes("'workflow'"),
    'sightengine check.json request must not contain a workflow parameter'
  );
  assert.ok(
    sightengineSource.includes("append('media'"),
    'sightengine check.json request must send the image as a multipart media file field'
  );
  assert.ok(
    !sightengineSource.includes("'base64'"),
    'sightengine check.json request must not send a base64 field'
  );
  assert.ok(
    !sightengineSource.includes('application/x-www-form-urlencoded'),
    'sightengine check.json request must not declare a urlencoded Content-Type'
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

    // Request shape pins (2026-11-28 live failures): detectDeepfake POSTs
    // to the plain check.json path, which rejects any request that also
    // carries a workflow id (Sightengine HTTP 400, argument_error code
    // 2004: "You specified a workflow id in your request but used a
    // non-workflow API path"), and rejects a body that is not correctly
    // encoded form data (HTTP 400, argument_error code 1041) — the old
    // code declared application/x-www-form-urlencoded while axios sent a
    // JSON body with a base64 field. The request must be a multipart
    // FormData carrying the image as a `media` file field, the API
    // credentials, models=genai, NO workflow entry, and no manually set
    // Content-Type header (axios must generate the multipart boundary).
    let capturedUrl: unknown;
    let capturedPayload: unknown;
    let capturedConfig: unknown;
    axios.post = async (url: unknown, payload: unknown, config: unknown) => {
      capturedUrl = url;
      capturedPayload = payload;
      capturedConfig = config;
      return { data: { status: 'success', scores: { synthetic: 0.1, human: 0.9 } } };
    };
    await detectDeepfake(Buffer.from('fake-image'));
    assert.equal(capturedUrl, 'https://api.sightengine.com/1.0/check.json');
    assert.ok(capturedPayload instanceof FormData, 'check.json request body must be a FormData');
    const form = capturedPayload as FormData;
    assert.equal(form.get('models'), 'genai');
    assert.equal(form.get('api_user'), process.env.SIGHTENGINE_API_KEY);
    assert.equal(form.get('api_secret'), process.env.SIGHTENGINE_API_SECRET);
    const media = form.get('media') as { size?: unknown } | null;
    assert.ok(media, 'check.json request must carry a media file field');
    assert.equal(typeof media.size, 'number');
    assert.ok((media.size as number) > 0, 'media file field must not be empty');
    assert.equal(form.get('workflow'), null, 'check.json request must not contain a workflow parameter');
    assert.equal(form.get('base64'), null, 'check.json request must not contain a base64 field');
    const config = capturedConfig as { headers?: Record<string, unknown> } | undefined;
    assert.ok(
      !config?.headers || !('Content-Type' in config.headers),
      'check.json request must not set a Content-Type header manually'
    );
  } finally {
    axios.post = originalPost;
  }

  console.log('Sightengine response validation assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
