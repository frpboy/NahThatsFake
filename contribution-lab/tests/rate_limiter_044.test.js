const test = require('node:test');
const assert = require('node:assert');
const { RateLimiter44 } = require('../tools/rate_limiter_044.js');

test('RateLimiter44 enforces quota limits within sliding window', () => {
  const limiter = new RateLimiter44(2, 1000);
  const now = 10000;
  assert.strictEqual(limiter.isAllowed(now), true);
  assert.strictEqual(limiter.isAllowed(now + 10), true);
  assert.strictEqual(limiter.isAllowed(now + 20), false); // Exceeded

  // Next window
  assert.strictEqual(limiter.isAllowed(now + 1001), true);
});
