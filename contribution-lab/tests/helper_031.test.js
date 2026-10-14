const test = require('node:test');
const assert = require('node:assert');
const { formatHelper31, parseHelper31 } = require('../utils/helper_031.js');

test('formatHelper31 serializes and parses key-value structures', () => {
  const sample = { id: '31', status: 'active', test: 'val' };
  const formatted = formatHelper31(sample);
  assert.ok(formatted.startsWith('[UTIL_31]'));

  const parsed = parseHelper31(formatted);
  assert.strictEqual(parsed.id, '31');
  assert.strictEqual(parsed.status, 'active');
});
