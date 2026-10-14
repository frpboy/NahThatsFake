/**
 * Rate Limiting Policy Simulator 17
 */

class RateLimiter17 {
  constructor(maxRequests = 27, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  isAllowed(now = Date.now()) {
    this.timestamps = this.timestamps.filter(ts => now - ts < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  reset() {
    this.timestamps = [];
  }
}

module.exports = { RateLimiter17 };
