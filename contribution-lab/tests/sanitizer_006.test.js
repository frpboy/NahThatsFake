const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput6 } = require('../tools/sanitizer_006.js');

test('sanitizeInput6 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput6('  test\u0000sample_6  ');
  assert.strictEqual(res.sanitized, 'testsample_6');
  assert.strictEqual(res.sanitizerId, 6);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput6(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
