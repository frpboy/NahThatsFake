const test = require('node:test');
const assert = require('node:assert');
const { transformPayload21 } = require('../tools/transform_021.js');

test('transformPayload21 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_21', token: 'secret_val' };
  const res = transformPayload21(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 21);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload21(null);
  assert.strictEqual(invalid.success, false);
});
