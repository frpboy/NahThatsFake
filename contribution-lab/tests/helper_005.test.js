const test = require('node:test');
const assert = require('node:assert');
const { formatHelper5, parseHelper5 } = require('../utils/helper_005.js');

test('formatHelper5 serializes and parses key-value structures', () => {
  const sample = { id: '5', status: 'active', test: 'val' };
  const formatted = formatHelper5(sample);
  assert.ok(formatted.startsWith('[UTIL_5]'));

  const parsed = parseHelper5(formatted);
  assert.strictEqual(parsed.id, '5');
  assert.strictEqual(parsed.status, 'active');
});
