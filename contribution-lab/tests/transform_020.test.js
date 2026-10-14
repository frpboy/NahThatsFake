const test = require('node:test');
const assert = require('node:assert');
const { transformPayload20 } = require('../tools/transform_020.js');

test('transformPayload20 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_20', token: 'secret_val' };
  const res = transformPayload20(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 20);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload20(null);
  assert.strictEqual(invalid.success, false);
});
