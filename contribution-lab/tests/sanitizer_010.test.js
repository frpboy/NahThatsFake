const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput10 } = require('../tools/sanitizer_010.js');

test('sanitizeInput10 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput10('  test\u0000sample_10  ');
  assert.strictEqual(res.sanitized, 'testsample_10');
  assert.strictEqual(res.sanitizerId, 10);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput10(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
