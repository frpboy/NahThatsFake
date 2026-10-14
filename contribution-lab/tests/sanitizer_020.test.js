const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput20 } = require('../tools/sanitizer_020.js');

test('sanitizeInput20 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput20('  test\u0000sample_20  ');
  assert.strictEqual(res.sanitized, 'testsample_20');
  assert.strictEqual(res.sanitizerId, 20);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput20(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
