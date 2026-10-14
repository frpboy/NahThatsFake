const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput44 } = require('../tools/sanitizer_044.js');

test('sanitizeInput44 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput44('  test\u0000sample_44  ');
  assert.strictEqual(res.sanitized, 'testsample_44');
  assert.strictEqual(res.sanitizerId, 44);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput44(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
