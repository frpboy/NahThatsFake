const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput26 } = require('../tools/sanitizer_026.js');

test('sanitizeInput26 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput26('  test\u0000sample_26  ');
  assert.strictEqual(res.sanitized, 'testsample_26');
  assert.strictEqual(res.sanitizerId, 26);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput26(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
