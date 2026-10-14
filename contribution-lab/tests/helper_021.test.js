const test = require('node:test');
const assert = require('node:assert');
const { formatHelper21, parseHelper21 } = require('../utils/helper_021.js');

test('formatHelper21 serializes and parses key-value structures', () => {
  const sample = { id: '21', status: 'active', test: 'val' };
  const formatted = formatHelper21(sample);
  assert.ok(formatted.startsWith('[UTIL_21]'));

  const parsed = parseHelper21(formatted);
  assert.strictEqual(parsed.id, '21');
  assert.strictEqual(parsed.status, 'active');
});
