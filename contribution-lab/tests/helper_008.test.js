const test = require('node:test');
const assert = require('node:assert');
const { formatHelper8, parseHelper8 } = require('../utils/helper_008.js');

test('formatHelper8 serializes and parses key-value structures', () => {
  const sample = { id: '8', status: 'active', test: 'val' };
  const formatted = formatHelper8(sample);
  assert.ok(formatted.startsWith('[UTIL_8]'));

  const parsed = parseHelper8(formatted);
  assert.strictEqual(parsed.id, '8');
  assert.strictEqual(parsed.status, 'active');
});
