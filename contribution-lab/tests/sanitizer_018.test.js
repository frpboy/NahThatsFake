const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput18 } = require('../tools/sanitizer_018.js');

test('sanitizeInput18 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput18('  test\u0000sample_18  ');
  assert.strictEqual(res.sanitized, 'testsample_18');
  assert.strictEqual(res.sanitizerId, 18);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput18(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
