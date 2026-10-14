const test = require('node:test');
const assert = require('node:assert');
const { formatHelper12, parseHelper12 } = require('../utils/helper_012.js');

test('formatHelper12 serializes and parses key-value structures', () => {
  const sample = { id: '12', status: 'active', test: 'val' };
  const formatted = formatHelper12(sample);
  assert.ok(formatted.startsWith('[UTIL_12]'));

  const parsed = parseHelper12(formatted);
  assert.strictEqual(parsed.id, '12');
  assert.strictEqual(parsed.status, 'active');
});
