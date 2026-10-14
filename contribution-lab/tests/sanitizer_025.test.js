const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput25 } = require('../tools/sanitizer_025.js');

test('sanitizeInput25 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput25('  test\u0000sample_25  ');
  assert.strictEqual(res.sanitized, 'testsample_25');
  assert.strictEqual(res.sanitizerId, 25);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput25(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
