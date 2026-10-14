const test = require('node:test');
const assert = require('node:assert');
const { formatHelper19, parseHelper19 } = require('../utils/helper_019.js');

test('formatHelper19 serializes and parses key-value structures', () => {
  const sample = { id: '19', status: 'active', test: 'val' };
  const formatted = formatHelper19(sample);
  assert.ok(formatted.startsWith('[UTIL_19]'));

  const parsed = parseHelper19(formatted);
  assert.strictEqual(parsed.id, '19');
  assert.strictEqual(parsed.status, 'active');
});
