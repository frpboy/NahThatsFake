const test = require('node:test');
const assert = require('node:assert');
const { sanitizeInput35 } = require('../tools/sanitizer_035.js');

test('sanitizeInput35 normalizes whitespace and removes control characters', () => {
  const res = sanitizeInput35('  test\u0000sample_35  ');
  assert.strictEqual(res.sanitized, 'testsample_35');
  assert.strictEqual(res.sanitizerId, 35);
  assert.ok(res.flags.includes('CONTROL_CHARS_REMOVED'));

  const nonStr = sanitizeInput35(12345);
  assert.strictEqual(nonStr.sanitized, '');
  assert.ok(nonStr.flags.includes('NON_STRING_INPUT'));
});
