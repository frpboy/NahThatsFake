const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput38 } = require('../tools/sanitizer_038.js');

test('sanitizeInput38 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput38('  test\u0000sample_38  ');
  assert.strictEqual(res.sanitized, 'testsample_38');
  assert.strictEqual(res.sanitizerId, 38);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput38(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
