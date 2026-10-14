const test = require('node:test');
const assert = require('node:assert');
const { transformPayload14 } = require('../tools/transform_014.js');

test('transformPayload14 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_14', token: 'secret_val' };
  const res = transformPayload14(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 14);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload14(null);
  assert.strictEqual(invalid.success, false);
});
