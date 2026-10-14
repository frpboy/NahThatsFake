const test = require('node:test');
const assert = require('node:assert');
const { transformPayload5 } = require('../tools/transform_005.js');

test('transformPayload5 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_5', token: 'secret_val' };
  const res = transformPayload5(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 5);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload5(null);
  assert.strictEqual(invalid.success, false);
});
