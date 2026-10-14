const test = require('node:test');
const assert = require('node:assert');
const { transformPayload49 } = require('../tools/transform_049.js');

test('transformPayload49 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_49', token: 'secret_val' };
  const res = transformPayload49(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 49);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload49(null);
  assert.strictEqual(invalid.success, false);
});
