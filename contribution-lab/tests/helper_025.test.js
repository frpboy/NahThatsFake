const test = require('node:test');
const assert = require('node:assert');
const { formatHelper25, parseHelper25 } = require('../utils/helper_025.js');

test('formatHelper25 serializes and parses key-value structures', () => {
  const sample = { id: '25', status: 'active', test: 'val' };
  const formatted = formatHelper25(sample);
  assert.ok(formatted.startsWith('[UTIL_25]'));

  const parsed = parseHelper25(formatted);
  assert.strictEqual(parsed.id, '25');
  assert.strictEqual(parsed.status, 'active');
});
