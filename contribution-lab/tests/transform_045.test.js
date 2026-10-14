const test = require('node:test');
const assert = require('node:assert');
const { transformPayload45 } = require('../tools/transform_045.js');

test('transformPayload45 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_45', token: 'secret_val' };
  const res = transformPayload45(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 45);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload45(null);
  assert.strictEqual(invalid.success, false);
});
