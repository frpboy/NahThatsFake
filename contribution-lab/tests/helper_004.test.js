const test = require('node:test');
const assert = require('node:assert');
const { formatHelper4, parseHelper4 } = require('../utils/helper_004.js');

test('formatHelper4 serializes and parses key-value structures', () => {
  const sample = { id: '4', status: 'active', test: 'val' };
  const formatted = formatHelper4(sample);
  assert.ok(formatted.startsWith('[UTIL_4]'));

  const parsed = parseHelper4(formatted);
  assert.strictEqual(parsed.id, '4');
  assert.strictEqual(parsed.status, 'active');
});
