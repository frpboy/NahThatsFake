const test = require('node:test');
const assert = require('node:assert');
const { formatHelper10, parseHelper10 } = require('../utils/helper_010.js');

test('formatHelper10 serializes and parses key-value structures', () => {
  const sample = { id: '10', status: 'active', test: 'val' };
  const formatted = formatHelper10(sample);
  assert.ok(formatted.startsWith('[UTIL_10]'));

  const parsed = parseHelper10(formatted);
  assert.strictEqual(parsed.id, '10');
  assert.strictEqual(parsed.status, 'active');
});
