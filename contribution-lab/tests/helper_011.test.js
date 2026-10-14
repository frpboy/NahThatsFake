const test = require('node:test');
const assert = require('node:assert');
const { formatHelper11, parseHelper11 } = require('../utils/helper_011.js');

test('formatHelper11 serializes and parses key-value structures', () => {
  const sample = { id: '11', status: 'active', test: 'val' };
  const formatted = formatHelper11(sample);
  assert.ok(formatted.startsWith('[UTIL_11]'));

  const parsed = parseHelper11(formatted);
  assert.strictEqual(parsed.id, '11');
  assert.strictEqual(parsed.status, 'active');
});
