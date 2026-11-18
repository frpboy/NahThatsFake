'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

process.env.NODE_ENV = 'production';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_disabled_purchases';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
process.env.BOT_TOKEN = '123456:test-bot-token';

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

const initData = makeTelegramInitData();

test('Razorpay order creation is permanently disabled with HTTP 410', async () => {
  const response = await request(app)
    .post('/api/payment/create-razorpay-order')
    .set('X-Telegram-Init-Data', initData)
    .send({ planId: 'ind_monthly' });

  assert.equal(response.status, 410);
  assert.deepEqual(response.body, { error: 'Payments are no longer accepted' });
});

test('Telegram Stars invoice creation is permanently disabled with HTTP 410', async () => {
  const response = await request(app)
    .post('/api/payment/create-stars-invoice')
    .set('X-Telegram-Init-Data', initData)
    .send({ planId: 'ind_monthly' });

  assert.equal(response.status, 410);
  assert.deepEqual(response.body, { error: 'Payments are no longer accepted' });
});

test('Razorpay verification remains available for existing payment reconciliation', async () => {
  const response = await request(app)
    .post('/api/payment/verify-razorpay')
    .set('X-Telegram-Init-Data', initData)
    .send({
      planId: 'ind_monthly',
      razorpay_payment_id: 'pay_test_existing',
      razorpay_order_id: 'order_test_existing',
      razorpay_signature: 'invalid-signature'
    });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    error: 'Signature verification failed'
  });
});

test('Razorpay webhook reconciliation route remains registered', async () => {
  const response = await request(app)
    .post('/api/payment/razorpay-webhook')
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.text, 'Missing signature');
});

test('premium page contains no checkout controls or payment SDK', () => {
  const premiumHtml = fs.readFileSync(path.join(__dirname, '../public/premium.html'), 'utf8');

  assert.match(premiumHtml, /Purchases are no longer available/);
  assert.doesNotMatch(premiumHtml, /checkout\.razorpay\.com|payRazorpay|payStars|Pay ₹/);
});

test('bot keeps successful-payment reconciliation without advertising new purchases', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const botIndex = fs.readFileSync(path.join(repoRoot, 'bot/src/index.ts'), 'utf8');
  const paymentHandler = fs.readFileSync(path.join(repoRoot, 'bot/src/handlers/payment.ts'), 'utf8');

  assert.match(botIndex, /bot\.on\('message:successful_payment', handleSuccessfulPayment\)/);
  assert.match(paymentHandler, /fulfill_payment/);
  assert.match(botIndex, /Purchases are no longer available/);
  assert.doesNotMatch(botIndex, /Pay with UPI, cards, or Telegram Stars|Upgrade Now|Go Premium/);
});
