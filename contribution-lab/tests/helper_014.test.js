const test = require('node:test');
const assert = require('node:assert');
const { formatHelper14, parseHelper14 } = require('../utils/helper_014.js');

test('formatHelper14 serializes and parses key-value structures', () => {
  const sample = { id: '14', status: 'active', test: 'val' };
  const formatted = formatHelper14(sample);
  assert.ok(formatted.startsWith('[UTIL_14]'));

  const parsed = parseHelper14(formatted);
  assert.strictEqual(parsed.id, '14');
  assert.strictEqual(parsed.status, 'active');
});
