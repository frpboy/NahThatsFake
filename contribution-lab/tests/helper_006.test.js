const test = require('node:test');
const assert = require('node:assert');
const { formatHelper6, parseHelper6 } = require('../utils/helper_006.js');

test('formatHelper6 serializes and parses key-value structures', () => {
  const sample = { id: '6', status: 'active', test: 'val' };
  const formatted = formatHelper6(sample);
  assert.ok(formatted.startsWith('[UTIL_6]'));

  const parsed = parseHelper6(formatted);
  assert.strictEqual(parsed.id, '6');
  assert.strictEqual(parsed.status, 'active');
});
