const test = require('node:test');
const assert = require('node:assert');
const { transformPayload12 } = require('../tools/transform_012.js');

test('transformPayload12 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_12', token: 'secret_val' };
  const res = transformPayload12(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 12);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload12(null);
  assert.strictEqual(invalid.success, false);
});
