const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput33 } = require('../tools/sanitizer_033.js');

test('sanitizeInput33 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput33('  test\u0000sample_33  ');
  assert.strictEqual(res.sanitized, 'testsample_33');
  assert.strictEqual(res.sanitizerId, 33);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput33(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
