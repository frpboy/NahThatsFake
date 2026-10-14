const test = require('node:test');
const assert = require('node:assert');
const { formatHelper18, parseHelper18 } = require('../utils/helper_018.js');

test('formatHelper18 serializes and parses key-value structures', () => {
  const sample = { id: '18', status: 'active', test: 'val' };
  const formatted = formatHelper18(sample);
  assert.ok(formatted.startsWith('[UTIL_18]'));

  const parsed = parseHelper18(formatted);
  assert.strictEqual(parsed.id, '18');
  assert.strictEqual(parsed.status, 'active');
});
