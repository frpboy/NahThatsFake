const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput41 } = require('../tools/sanitizer_041.js');

test('sanitizeInput41 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput41('  test\u0000sample_41  ');
  assert.strictEqual(res.sanitized, 'testsample_41');
  assert.strictEqual(res.sanitizerId, 41);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput41(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
