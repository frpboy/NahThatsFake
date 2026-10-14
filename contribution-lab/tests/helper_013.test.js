const test = require('node:test');
const assert = require('node:assert');
const { formatHelper13, parseHelper13 } = require('../utils/helper_013.js');

test('formatHelper13 serializes and parses key-value structures', () => {
  const sample = { id: '13', status: 'active', test: 'val' };
  const formatted = formatHelper13(sample);
  assert.ok(formatted.startsWith('[UTIL_13]'));

  const parsed = parseHelper13(formatted);
  assert.strictEqual(parsed.id, '13');
  assert.strictEqual(parsed.status, 'active');
});
