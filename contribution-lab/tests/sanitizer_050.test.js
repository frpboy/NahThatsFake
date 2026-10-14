const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput50 } = require('../tools/sanitizer_050.js');

test('sanitizeInput50 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput50('  test\u0000sample_50  ');
  assert.strictEqual(res.sanitized, 'testsample_50');
  assert.strictEqual(res.sanitizerId, 50);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput50(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
