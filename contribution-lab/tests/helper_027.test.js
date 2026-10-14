const test = require('node:test');
const assert = require('node:assert');
const { formatHelper27, parseHelper27 } = require('../utils/helper_027.js');

test('formatHelper27 serializes and parses key-value structures', () => {
  const sample = { id: '27', status: 'active', test: 'val' };
  const formatted = formatHelper27(sample);
  assert.ok(formatted.startsWith('[UTIL_27]'));

  const parsed = parseHelper27(formatted);
  assert.strictEqual(parsed.id, '27');
  assert.strictEqual(parsed.status, 'active');
});
