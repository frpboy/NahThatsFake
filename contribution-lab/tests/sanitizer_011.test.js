const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput11 } = require('../tools/sanitizer_011.js');

test('sanitizeInput11 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput11('  test\u0000sample_11  ');
  assert.strictEqual(res.sanitized, 'testsample_11');
  assert.strictEqual(res.sanitizerId, 11);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput11(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
