const test = require('node:test');
const assert = require('node:assert');
const { formatHelper29, parseHelper29 } = require('../utils/helper_029.js');

test('formatHelper29 serializes and parses key-value structures', () => {
  const sample = { id: '29', status: 'active', test: 'val' };
  const formatted = formatHelper29(sample);
  assert.ok(formatted.startsWith('[UTIL_29]'));

  const parsed = parseHelper29(formatted);
  assert.strictEqual(parsed.id, '29');
  assert.strictEqual(parsed.status, 'active');
});
