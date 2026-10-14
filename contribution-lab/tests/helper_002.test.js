const test = require('node:test');
const assert = require('node:assert');
const { formatHelper2, parseHelper2 } = require('../utils/helper_002.js');

test('formatHelper2 serializes and parses key-value structures', () => {
  const sample = { id: '2', status: 'active', test: 'val' };
  const formatted = formatHelper2(sample);
  assert.ok(formatted.startsWith('[UTIL_2]'));

  const parsed = parseHelper2(formatted);
  assert.strictEqual(parsed.id, '2');
  assert.strictEqual(parsed.status, 'active');
});
