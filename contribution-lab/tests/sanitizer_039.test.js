const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput39 } = require('../tools/sanitizer_039.js');

test('sanitizeInput39 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput39('  test\u0000sample_39  ');
  assert.strictEqual(res.sanitized, 'testsample_39');
  assert.strictEqual(res.sanitizerId, 39);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput39(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
