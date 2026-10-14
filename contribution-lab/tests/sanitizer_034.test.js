const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput34 } = require('../tools/sanitizer_034.js');

test('sanitizeInput34 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput34('  test\u0000sample_34  ');
  assert.strictEqual(res.sanitized, 'testsample_34');
  assert.strictEqual(res.sanitizerId, 34);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput34(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
