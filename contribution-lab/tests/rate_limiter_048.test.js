const test = require('node:test');
const assert = require('node:assert');
const { RateLimiter48 } = require('../tools/rate_limiter_048.js');

test('RateLimiter48 enforces quota limits within sliding window', () => {
  const limiter = new RateLimiter48(2, 1000);
  const now = 10000;
  assert.strictEqual(limiter.isAllowed(now), true);
  assert.strictEqual(limiter.isAllowed(now + 10), true);
  assert.strictEqual(limiter.isAllowed(now + 20), false); // Exceeded

  // Next window
  assert.strictEqual(limiter.isAllowed(now + 1001), true);
});
