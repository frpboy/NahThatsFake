const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput40 } = require('../tools/sanitizer_040.js');

test('sanitizeInput40 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput40('  test\u0000sample_40  ');
  assert.strictEqual(res.sanitized, 'testsample_40');
  assert.strictEqual(res.sanitizerId, 40);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput40(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
