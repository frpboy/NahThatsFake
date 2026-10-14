const test = require('node:test');
const assert = require('node:assert');
const { formatHelper9, parseHelper9 } = require('../utils/helper_009.js');

test('formatHelper9 serializes and parses key-value structures', () => {
  const sample = { id: '9', status: 'active', test: 'val' };
  const formatted = formatHelper9(sample);
  assert.ok(formatted.startsWith('[UTIL_9]'));

  const parsed = parseHelper9(formatted);
  assert.strictEqual(parsed.id, '9');
  assert.strictEqual(parsed.status, 'active');
});
