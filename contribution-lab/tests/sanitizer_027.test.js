const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput27 } = require('../tools/sanitizer_027.js');

test('sanitizeInput27 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput27('  test\u0000sample_27  ');
  assert.strictEqual(res.sanitized, 'testsample_27');
  assert.strictEqual(res.sanitizerId, 27);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput27(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
