const test = require('node:test');
const assert = require('node:assert');
const { transformPayload34 } = require('../tools/transform_034.js');

test('transformPayload34 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_34', token: 'secret_val' };
  const res = transformPayload34(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 34);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload34(null);
  assert.strictEqual(invalid.success, false);
});
