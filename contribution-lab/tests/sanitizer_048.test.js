const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput48 } = require('../tools/sanitizer_048.js');

test('sanitizeInput48 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput48('  test\u0000sample_48  ');
  assert.strictEqual(res.sanitized, 'testsample_48');
  assert.strictEqual(res.sanitizerId, 48);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput48(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
