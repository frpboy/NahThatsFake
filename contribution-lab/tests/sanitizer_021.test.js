const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput21 } = require('../tools/sanitizer_021.js');

test('sanitizeInput21 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput21('  test\u0000sample_21  ');
  assert.strictEqual(res.sanitized, 'testsample_21');
  assert.strictEqual(res.sanitizerId, 21);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput21(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
