const test = require('node:test');
const assert = require('node:assert');
const { formatHelper3, parseHelper3 } = require('../utils/helper_003.js');

test('formatHelper3 serializes and parses key-value structures', () => {
  const sample = { id: '3', status: 'active', test: 'val' };
  const formatted = formatHelper3(sample);
  assert.ok(formatted.startsWith('[UTIL_3]'));

  const parsed = parseHelper3(formatted);
  assert.strictEqual(parsed.id, '3');
  assert.strictEqual(parsed.status, 'active');
});
