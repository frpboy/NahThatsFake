const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput32 } = require('../tools/sanitizer_032.js');

test('sanitizeInput32 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput32('  test\u0000sample_32  ');
  assert.strictEqual(res.sanitized, 'testsample_32');
  assert.strictEqual(res.sanitizerId, 32);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput32(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
