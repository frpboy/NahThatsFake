const test = require('node:test');
const assert = require('node:assert');
const { transformPayload28 } = require('../tools/transform_028.js');

test('transformPayload28 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_28', token: 'secret_val' };
  const res = transformPayload28(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 28);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload28(null);
  assert.strictEqual(invalid.success, false);
});
