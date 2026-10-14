const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput36 } = require('../tools/sanitizer_036.js');

test('sanitizeInput36 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput36('  test\u0000sample_36  ');
  assert.strictEqual(res.sanitized, 'testsample_36');
  assert.strictEqual(res.sanitizerId, 36);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput36(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
