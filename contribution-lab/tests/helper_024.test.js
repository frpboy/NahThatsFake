const test = require('node:test');
const assert = require('node:assert');
const { formatHelper24, parseHelper24 } = require('../utils/helper_024.js');

test('formatHelper24 serializes and parses key-value structures', () => {
  const sample = { id: '24', status: 'active', test: 'val' };
  const formatted = formatHelper24(sample);
  assert.ok(formatted.startsWith('[UTIL_24]'));

  const parsed = parseHelper24(formatted);
  assert.strictEqual(parsed.id, '24');
  assert.strictEqual(parsed.status, 'active');
});
