const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput29 } = require('../tools/sanitizer_029.js');

test('sanitizeInput29 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput29('  test\u0000sample_29  ');
  assert.strictEqual(res.sanitized, 'testsample_29');
  assert.strictEqual(res.sanitizerId, 29);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput29(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
