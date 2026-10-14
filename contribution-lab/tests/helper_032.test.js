const test = require('node:test');
const assert = require('node:assert');
const { formatHelper32, parseHelper32 } = require('../utils/helper_032.js');

test('formatHelper32 serializes and parses key-value structures', () => {
  const sample = { id: '32', status: 'active', test: 'val' };
  const formatted = formatHelper32(sample);
  assert.ok(formatted.startsWith('[UTIL_32]'));

  const parsed = parseHelper32(formatted);
  assert.strictEqual(parsed.id, '32');
  assert.strictEqual(parsed.status, 'active');
});
