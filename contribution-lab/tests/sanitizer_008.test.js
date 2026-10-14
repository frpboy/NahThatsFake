const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput8 } = require('../tools/sanitizer_008.js');

test('sanitizeInput8 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput8('  test\u0000sample_8  ');
  assert.strictEqual(res.sanitized, 'testsample_8');
  assert.strictEqual(res.sanitizerId, 8);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput8(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
