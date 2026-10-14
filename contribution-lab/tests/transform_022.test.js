const test = require('node:test');
const assert = require('node:assert');
const { transformPayload22 } = require('../tools/transform_022.js');

test('transformPayload22 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_22', token: 'secret_val' };
  const res = transformPayload22(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 22);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload22(null);
  assert.strictEqual(invalid.success, false);
});
