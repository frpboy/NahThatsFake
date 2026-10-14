const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput37 } = require('../tools/sanitizer_037.js');

test('sanitizeInput37 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput37('  test\u0000sample_37  ');
  assert.strictEqual(res.sanitized, 'testsample_37');
  assert.strictEqual(res.sanitizerId, 37);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput37(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
