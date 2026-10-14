const test = require('node:test');
const assert = require('node:assert');
const { RateLimiter41 } = require('../tools/rate_limiter_041.js');

test('RateLimiter41 enforces quota limits within sliding window', () => {
  const limiter = new RateLimiter41(2, 1000);
  const now = 10000;
  assert.strictEqual(limiter.isAllowed(now), true);
  assert.strictEqual(limiter.isAllowed(now + 10), true);
  assert.strictEqual(limiter.isAllowed(now + 20), false); // Exceeded

  // Next window
  assert.strictEqual(limiter.isAllowed(now + 1001), true);
});
