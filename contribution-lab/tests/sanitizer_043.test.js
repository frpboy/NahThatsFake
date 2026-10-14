const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput43 } = require('../tools/sanitizer_043.js');

test('sanitizeInput43 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput43('  test\u0000sample_43  ');
  assert.strictEqual(res.sanitized, 'testsample_43');
  assert.strictEqual(res.sanitizerId, 43);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput43(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
