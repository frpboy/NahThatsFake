const test = require('node:test');
const assert = require('node:assert');
const { formatHelper7, parseHelper7 } = require('../utils/helper_007.js');

test('formatHelper7 serializes and parses key-value structures', () => {
  const sample = { id: '7', status: 'active', test: 'val' };
  const formatted = formatHelper7(sample);
  assert.ok(formatted.startsWith('[UTIL_7]'));

  const parsed = parseHelper7(formatted);
  assert.strictEqual(parsed.id, '7');
  assert.strictEqual(parsed.status, 'active');
});
