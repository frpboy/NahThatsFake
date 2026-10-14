const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput15 } = require('../tools/sanitizer_015.js');

test('sanitizeInput15 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput15('  test\u0000sample_15  ');
  assert.strictEqual(res.sanitized, 'testsample_15');
  assert.strictEqual(res.sanitizerId, 15);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput15(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
