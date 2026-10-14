const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput12 } = require('../tools/sanitizer_012.js');

test('sanitizeInput12 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput12('  test\u0000sample_12  ');
  assert.strictEqual(res.sanitized, 'testsample_12');
  assert.strictEqual(res.sanitizerId, 12);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput12(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
