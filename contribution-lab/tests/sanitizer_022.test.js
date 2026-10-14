const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput22 } = require('../tools/sanitizer_022.js');

test('sanitizeInput22 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput22('  test\u0000sample_22  ');
  assert.strictEqual(res.sanitized, 'testsample_22');
  assert.strictEqual(res.sanitizerId, 22);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput22(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
