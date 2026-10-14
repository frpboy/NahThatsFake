const test = require('node:test');
const assert = require('node:assert');
const { formatHelper28, parseHelper28 } = require('../utils/helper_028.js');

test('formatHelper28 serializes and parses key-value structures', () => {
  const sample = { id: '28', status: 'active', test: 'val' };
  const formatted = formatHelper28(sample);
  assert.ok(formatted.startsWith('[UTIL_28]'));

  const parsed = parseHelper28(formatted);
  assert.strictEqual(parsed.id, '28');
  assert.strictEqual(parsed.status, 'active');
});
