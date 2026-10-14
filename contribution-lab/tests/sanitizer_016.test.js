const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput16 } = require('../tools/sanitizer_016.js');

test('sanitizeInput16 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput16('  test\u0000sample_16  ');
  assert.strictEqual(res.sanitized, 'testsample_16');
  assert.strictEqual(res.sanitizerId, 16);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput16(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
