const test = require('node:test');
const assert = require('node:assert');
const { formatHelper35, parseHelper35 } = require('../utils/helper_035.js');

test('formatHelper35 serializes and parses key-value structures', () => {
  const sample = { id: '35', status: 'active', test: 'val' };
  const formatted = formatHelper35(sample);
  assert.ok(formatted.startsWith('[UTIL_35]'));

  const parsed = parseHelper35(formatted);
  assert.strictEqual(parsed.id, '35');
  assert.strictEqual(parsed.status, 'active');
});
