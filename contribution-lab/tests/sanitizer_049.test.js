const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput49 } = require('../tools/sanitizer_049.js');

test('sanitizeInput49 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput49('  test\u0000sample_49  ');
  assert.strictEqual(res.sanitized, 'testsample_49');
  assert.strictEqual(res.sanitizerId, 49);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput49(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
