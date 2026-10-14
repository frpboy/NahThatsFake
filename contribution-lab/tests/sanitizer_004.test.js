const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput4 } = require('../tools/sanitizer_004.js');

test('sanitizeInput4 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput4('  test\u0000sample_4  ');
  assert.strictEqual(res.sanitized, 'testsample_4');
  assert.strictEqual(res.sanitizerId, 4);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput4(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
