const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput3 } = require('../tools/sanitizer_003.js');

test('sanitizeInput3 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput3('  test\u0000sample_3  ');
  assert.strictEqual(res.sanitized, 'testsample_3');
  assert.strictEqual(res.sanitizerId, 3);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput3(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
