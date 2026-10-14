const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput9 } = require('../tools/sanitizer_009.js');

test('sanitizeInput9 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput9('  test\u0000sample_9  ');
  assert.strictEqual(res.sanitized, 'testsample_9');
  assert.strictEqual(res.sanitizerId, 9);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput9(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
