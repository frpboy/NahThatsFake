const test = require('node:test');
const assert = require('node:assert');
const { transformPayload35 } = require('../tools/transform_035.js');

test('transformPayload35 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_35', token: 'secret_val' };
  const res = transformPayload35(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 35);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload35(null);
  assert.strictEqual(invalid.success, false);
});
