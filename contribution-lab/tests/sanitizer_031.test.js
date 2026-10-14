const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput31 } = require('../tools/sanitizer_031.js');

test('sanitizeInput31 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput31('  test\u0000sample_31  ');
  assert.strictEqual(res.sanitized, 'testsample_31');
  assert.strictEqual(res.sanitizerId, 31);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput31(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
