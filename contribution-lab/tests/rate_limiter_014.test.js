const test = require('node:test');
const assert = require('node:assert');
const { RateLimiter14 } = require('../tools/rate_limiter_014.js');

test('RateLimiter14 enforces quota limits within sliding window', () => {
  const limiter = new RateLimiter14(2, 1000);
  const now = 10000;
  assert.strictEqual(limiter.isAllowed(now), true);
  assert.strictEqual(limiter.isAllowed(now + 10), true);
  assert.strictEqual(limiter.isAllowed(now + 20), false); // Exceeded

  // Next window
  assert.strictEqual(limiter.isAllowed(now + 1001), true);
});
