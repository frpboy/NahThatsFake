const test = require('node:test');
const assert = require('node:assert');
const { formatHelper22, parseHelper22 } = require('../utils/helper_022.js');

test('formatHelper22 serializes and parses key-value structures', () => {
  const sample = { id: '22', status: 'active', test: 'val' };
  const formatted = formatHelper22(sample);
  assert.ok(formatted.startsWith('[UTIL_22]'));

  const parsed = parseHelper22(formatted);
  assert.strictEqual(parsed.id, '22');
  assert.strictEqual(parsed.status, 'active');
});
