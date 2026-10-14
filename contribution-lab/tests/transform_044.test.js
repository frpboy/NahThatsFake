const test = require('node:test');
const assert = require('node:assert');
const { transformPayload44 } = require('../tools/transform_044.js');

test('transformPayload44 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_44', token: 'secret_val' };
  const res = transformPayload44(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 44);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload44(null);
  assert.strictEqual(invalid.success, false);
});
