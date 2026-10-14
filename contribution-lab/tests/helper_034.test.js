const test = require('node:test');
const assert = require('node:assert');
const { formatHelper34, parseHelper34 } = require('../utils/helper_034.js');

test('formatHelper34 serializes and parses key-value structures', () => {
  const sample = { id: '34', status: 'active', test: 'val' };
  const formatted = formatHelper34(sample);
  assert.ok(formatted.startsWith('[UTIL_34]'));

  const parsed = parseHelper34(formatted);
  assert.strictEqual(parsed.id, '34');
  assert.strictEqual(parsed.status, 'active');
});
