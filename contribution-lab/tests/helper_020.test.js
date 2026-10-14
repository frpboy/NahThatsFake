const test = require('node:test');
const assert = require('node:assert');
const { formatHelper20, parseHelper20 } = require('../utils/helper_020.js');

test('formatHelper20 serializes and parses key-value structures', () => {
  const sample = { id: '20', status: 'active', test: 'val' };
  const formatted = formatHelper20(sample);
  assert.ok(formatted.startsWith('[UTIL_20]'));

  const parsed = parseHelper20(formatted);
  assert.strictEqual(parsed.id, '20');
  assert.strictEqual(parsed.status, 'active');
});
