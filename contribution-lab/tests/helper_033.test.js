const test = require('node:test');
const assert = require('node:assert');
const { formatHelper33, parseHelper33 } = require('../utils/helper_033.js');

test('formatHelper33 serializes and parses key-value structures', () => {
  const sample = { id: '33', status: 'active', test: 'val' };
  const formatted = formatHelper33(sample);
  assert.ok(formatted.startsWith('[UTIL_33]'));

  const parsed = parseHelper33(formatted);
  assert.strictEqual(parsed.id, '33');
  assert.strictEqual(parsed.status, 'active');
});
