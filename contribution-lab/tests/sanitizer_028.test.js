const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput28 } = require('../tools/sanitizer_028.js');

test('sanitizeInput28 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput28('  test\u0000sample_28  ');
  assert.strictEqual(res.sanitized, 'testsample_28');
  assert.strictEqual(res.sanitizerId, 28);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput28(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
