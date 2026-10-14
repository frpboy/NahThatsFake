const test = require('node:test');
const assert = require('node:assert');
const { formatHelper16, parseHelper16 } = require('../utils/helper_016.js');

test('formatHelper16 serializes and parses key-value structures', () => {
  const sample = { id: '16', status: 'active', test: 'val' };
  const formatted = formatHelper16(sample);
  assert.ok(formatted.startsWith('[UTIL_16]'));

  const parsed = parseHelper16(formatted);
  assert.strictEqual(parsed.id, '16');
  assert.strictEqual(parsed.status, 'active');
});
