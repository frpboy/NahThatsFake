const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput13 } = require('../tools/sanitizer_013.js');

test('sanitizeInput13 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput13('  test\u0000sample_13  ');
  assert.strictEqual(res.sanitized, 'testsample_13');
  assert.strictEqual(res.sanitizerId, 13);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput13(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
