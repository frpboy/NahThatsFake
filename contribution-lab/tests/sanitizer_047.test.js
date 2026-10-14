const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput47 } = require('../tools/sanitizer_047.js');

test('sanitizeInput47 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput47('  test\u0000sample_47  ');
  assert.strictEqual(res.sanitized, 'testsample_47');
  assert.strictEqual(res.sanitizerId, 47);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput47(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
