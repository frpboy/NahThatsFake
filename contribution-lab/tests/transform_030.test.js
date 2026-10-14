const test = require('node:test');
const assert = require('node:assert');
const { transformPayload30 } = require('../tools/transform_030.js');

test('transformPayload30 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_30', token: 'secret_val' };
  const res = transformPayload30(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 30);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload30(null);
  assert.strictEqual(invalid.success, false);
});
