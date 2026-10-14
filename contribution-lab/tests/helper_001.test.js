const test = require('node:test');
const assert = require('node:assert');
const { formatHelper1, parseHelper1 } = require('../utils/helper_001.js');

test('formatHelper1 serializes and parses key-value structures', () => {
  const sample = { id: '1', status: 'active', test: 'val' };
  const formatted = formatHelper1(sample);
  assert.ok(formatted.startsWith('[UTIL_1]'));

  const parsed = parseHelper1(formatted);
  assert.strictEqual(parsed.id, '1');
  assert.strictEqual(parsed.status, 'active');
});
