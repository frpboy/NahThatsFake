const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput19 } = require('../tools/sanitizer_019.js');

test('sanitizeInput19 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput19('  test\u0000sample_19  ');
  assert.strictEqual(res.sanitized, 'testsample_19');
  assert.strictEqual(res.sanitizerId, 19);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput19(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
