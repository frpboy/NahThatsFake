const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput46 } = require('../tools/sanitizer_046.js');

test('sanitizeInput46 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput46('  test\u0000sample_46  ');
  assert.strictEqual(res.sanitized, 'testsample_46');
  assert.strictEqual(res.sanitizerId, 46);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput46(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
