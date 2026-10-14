const test = require('node:test');
const assert = require('node:assert');
const { formatHelper15, parseHelper15 } = require('../utils/helper_015.js');

test('formatHelper15 serializes and parses key-value structures', () => {
  const sample = { id: '15', status: 'active', test: 'val' };
  const formatted = formatHelper15(sample);
  assert.ok(formatted.startsWith('[UTIL_15]'));

  const parsed = parseHelper15(formatted);
  assert.strictEqual(parsed.id, '15');
  assert.strictEqual(parsed.status, 'active');
});
