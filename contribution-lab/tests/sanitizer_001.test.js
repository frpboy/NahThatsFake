const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput1 } = require('../tools/sanitizer_001.js');

test('sanitizeInput1 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput1('  test\u0000sample_1  ');
  assert.strictEqual(res.sanitized, 'testsample_1');
  assert.strictEqual(res.sanitizerId, 1);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput1(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
