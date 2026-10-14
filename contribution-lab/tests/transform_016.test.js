const test = require('node:test');
const assert = require('node:assert');
const { transformPayload16 } = require('../tools/transform_016.js');

test('transformPayload16 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_16', token: 'secret_val' };
  const res = transformPayload16(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 16);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload16(null);
  assert.strictEqual(invalid.success, false);
});
