const test = require('node:test');
const assert = require('node:assert');
const { formatHelper26, parseHelper26 } = require('../utils/helper_026.js');

test('formatHelper26 serializes and parses key-value structures', () => {
  const sample = { id: '26', status: 'active', test: 'val' };
  const formatted = formatHelper26(sample);
  assert.ok(formatted.startsWith('[UTIL_26]'));

  const parsed = parseHelper26(formatted);
  assert.strictEqual(parsed.id, '26');
  assert.strictEqual(parsed.status, 'active');
});
