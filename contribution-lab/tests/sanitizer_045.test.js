const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput45 } = require('../tools/sanitizer_045.js');

test('sanitizeInput45 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput45('  test\u0000sample_45  ');
  assert.strictEqual(res.sanitized, 'testsample_45');
  assert.strictEqual(res.sanitizerId, 45);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput45(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
