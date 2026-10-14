const test = require('node:test');
const assert = require('node:assert');
const { transformPayload7 } = require('../tools/transform_007.js');

test('transformPayload7 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_7', token: 'secret_val' };
  const res = transformPayload7(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 7);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload7(null);
  assert.strictEqual(invalid.success, false);
});
