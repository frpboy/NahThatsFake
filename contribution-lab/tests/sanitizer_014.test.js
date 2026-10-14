const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput14 } = require('../tools/sanitizer_014.js');

test('sanitizeInput14 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput14('  test\u0000sample_14  ');
  assert.strictEqual(res.sanitized, 'testsample_14');
  assert.strictEqual(res.sanitizerId, 14);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput14(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
