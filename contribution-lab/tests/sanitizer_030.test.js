const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput30 } = require('../tools/sanitizer_030.js');

test('sanitizeInput30 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput30('  test\u0000sample_30  ');
  assert.strictEqual(res.sanitized, 'testsample_30');
  assert.strictEqual(res.sanitizerId, 30);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput30(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
