const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput42 } = require('../tools/sanitizer_042.js');

test('sanitizeInput42 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput42('  test\u0000sample_42  ');
  assert.strictEqual(res.sanitized, 'testsample_42');
  assert.strictEqual(res.sanitizerId, 42);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput42(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
