const test = require('node:test');
const assert = require('node:assert');
const { transformPayload19 } = require('../tools/transform_019.js');

test('transformPayload19 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_19', token: 'secret_val' };
  const res = transformPayload19(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 19);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload19(null);
  assert.strictEqual(invalid.success, false);
});
