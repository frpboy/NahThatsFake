const test = require('node:test');
const assert = require('node:assert');
const { transformPayload31 } = require('../tools/transform_031.js');

test('transformPayload31 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_31', token: 'secret_val' };
  const res = transformPayload31(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 31);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload31(null);
  assert.strictEqual(invalid.success, false);
});
