const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput17 } = require('../tools/sanitizer_017.js');

test('sanitizeInput17 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput17('  test\u0000sample_17  ');
  assert.strictEqual(res.sanitized, 'testsample_17');
  assert.strictEqual(res.sanitizerId, 17);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput17(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
