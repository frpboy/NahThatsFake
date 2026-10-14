const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput2 } = require('../tools/sanitizer_002.js');

test('sanitizeInput2 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput2('  test\u0000sample_2  ');
  assert.strictEqual(res.sanitized, 'testsample_2');
  assert.strictEqual(res.sanitizerId, 2);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput2(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
