const test = require('node:test');
const assert = require('node:assert');
const { formatHelper23, parseHelper23 } = require('../utils/helper_023.js');

test('formatHelper23 serializes and parses key-value structures', () => {
  const sample = { id: '23', status: 'active', test: 'val' };
  const formatted = formatHelper23(sample);
  assert.ok(formatted.startsWith('[UTIL_23]'));

  const parsed = parseHelper23(formatted);
  assert.strictEqual(parsed.id, '23');
  assert.strictEqual(parsed.status, 'active');
});
