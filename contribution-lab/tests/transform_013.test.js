const test = require('node:test');
const assert = require('node:assert');
const { transformPayload13 } = require('../tools/transform_013.js');

test('transformPayload13 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_13', token: 'secret_val' };
  const res = transformPayload13(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 13);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload13(null);
  assert.strictEqual(invalid.success, false);
});
