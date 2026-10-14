const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput23 } = require('../tools/sanitizer_023.js');

test('sanitizeInput23 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput23('  test\u0000sample_23  ');
  assert.strictEqual(res.sanitized, 'testsample_23');
  assert.strictEqual(res.sanitizerId, 23);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput23(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
