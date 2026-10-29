'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

// These fixed, synthetic values are used only in this isolated test process.
// No production credentials or external provider calls are required.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://ci-fixture.supabase.co';
process.env.SUPABASE_ANON_KEY = 'ci-anon-key-not-a-credential';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'ci-service-role-key-not-a-credential';
process.env.RAZORPAY_KEY_ID = 'rzp_test_ci_fixture';
process.env.RAZORPAY_KEY_SECRET = 'ci-razorpay-secret-not-a-credential';
process.env.BOT_TOKEN = '123456:CI_TEST_TOKEN_NOT_VALID';

const app = require('../server');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('GET /api/health returns a valid health response', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.timestamp, 'string');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)), 'timestamp must be parseable');
});

test('admin stats rejects requests without Telegram init data', async () => {
  const response = await fetch(`${baseUrl}/api/admin/stats`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: 'Missing X-Telegram-Init-Data header'
  });
});

test('Razorpay webhook rejects requests without a signature', async () => {
  const response = await fetch(`${baseUrl}/api/payment/razorpay-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'payment.captured', payload: {} })
  });

  assert.equal(response.status, 400);
  assert.equal(await response.text(), 'Missing signature');
});
