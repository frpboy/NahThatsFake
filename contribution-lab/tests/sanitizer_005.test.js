const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput5 } = require('../tools/sanitizer_005.js');

test('sanitizeInput5 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput5('  test\u0000sample_5  ');
  assert.strictEqual(res.sanitized, 'testsample_5');
  assert.strictEqual(res.sanitizerId, 5);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput5(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
