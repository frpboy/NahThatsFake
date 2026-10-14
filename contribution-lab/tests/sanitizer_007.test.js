const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput7 } = require('../tools/sanitizer_007.js');

test('sanitizeInput7 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput7('  test\u0000sample_7  ');
  assert.strictEqual(res.sanitized, 'testsample_7');
  assert.strictEqual(res.sanitizerId, 7);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput7(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
