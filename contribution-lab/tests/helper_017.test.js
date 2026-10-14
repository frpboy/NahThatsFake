const test = require('node:test');
const assert = require('node:assert');
const { formatHelper17, parseHelper17 } = require('../utils/helper_017.js');

test('formatHelper17 serializes and parses key-value structures', () => {
  const sample = { id: '17', status: 'active', test: 'val' };
  const formatted = formatHelper17(sample);
  assert.ok(formatted.startsWith('[UTIL_17]'));

  const parsed = parseHelper17(formatted);
  assert.strictEqual(parsed.id, '17');
  assert.strictEqual(parsed.status, 'active');
});
