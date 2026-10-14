const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput24 } = require('../tools/sanitizer_024.js');

test('sanitizeInput24 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput24('  test\u0000sample_24  ');
  assert.strictEqual(res.sanitized, 'testsample_24');
  assert.strictEqual(res.sanitizerId, 24);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput24(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
