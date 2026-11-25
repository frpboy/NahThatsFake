'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

process.env.NODE_ENV = 'production';
// A refused local port makes every Supabase sub-query fail immediately and
// deterministically — exactly the partial-failure situation this endpoint
// must survive.
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_disabled_purchases';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
process.env.BOT_TOKEN = 'test-bot-token';
process.env.OWNER_TELEGRAM_ID = '123456789';

const app = require('../server');

function makeTelegramInitData(userId = 123456789) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: 'Test' })
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => key + '=' + value)
    .join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('unauthenticated stats request is still 401', async () => {
  const response = await request(app).get('/api/admin/stats');
  assert.equal(response.status, 401);
});

test('owner stats request survives every sub-query failing: 200, nulls, named errors', async () => {
  const response = await request(app)
    .get('/api/admin/stats')
    .set('X-Telegram-Init-Data', makeTelegramInitData(123456789));

  assert.equal(response.status, 200);
  assert.equal(response.body.users, null);
  assert.equal(response.body.banned, null);
  assert.equal(response.body.checks, null);
  assert.equal(response.body.revenue, null);
  assert.deepEqual(
    [...response.body.errors].sort(),
    ['banned', 'checks', 'revenue', 'users']
  );
});

// --- Source-level guarantees (pattern of service-role-reads.test.js) ---

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

function routeBlock(route) {
  const start = serverSource.indexOf(`app.get('${route}'`);
  assert.notEqual(start, -1, `route ${route} not found`);
  const rest = serverSource.slice(start + 1);
  const next = rest.search(/app\.(get|post)\('/);
  return next === -1 ? serverSource.slice(start) : serverSource.slice(start, start + 1 + next);
}

test('stats endpoint settles sub-queries independently and names failures', () => {
  const block = routeBlock('/api/admin/stats');
  assert.match(block, /Promise\.allSettled/);
  assert.match(block, /Stats sub-query failed/);
  assert.doesNotMatch(block, /throw new Error\('Database error'\)/);
  assert.match(block, /errors/);
});

test('stats endpoint keeps its auth gates', () => {
  const block = routeBlock('/api/admin/stats');
  assert.match(block, /validateTelegramData/);
  assert.match(block, /status\(401\)/);
  assert.match(block, /status\(403\)/);
});

test('frontend dashes only null (failed) tiles and tolerates the missing stars element', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(appJs, /value === null \|\| value === undefined \? '-'/);
  assert.match(appJs, /d\.revenue \? '₹' \+ \(d\.revenue\.inr \|\| 0\) : '-'/);
});
