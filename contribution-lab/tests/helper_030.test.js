const test = require('node:test');
const assert = require('node:assert');
const { formatHelper30, parseHelper30 } = require('../utils/helper_030.js');

test('formatHelper30 serializes and parses key-value structures', () => {
  const sample = { id: '30', status: 'active', test: 'val' };
  const formatted = formatHelper30(sample);
  assert.ok(formatted.startsWith('[UTIL_30]'));

  const parsed = parseHelper30(formatted);
  assert.strictEqual(parsed.id, '30');
  assert.strictEqual(parsed.status, 'active');
});
