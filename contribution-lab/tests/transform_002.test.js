const test = require('node:test');
const assert = require('node:assert');
const { transformPayload2 } = require('../tools/transform_002.js');

test('transformPayload2 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_2', token: 'secret_val' };
  const res = transformPayload2(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 2);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload2(null);
  assert.strictEqual(invalid.success, false);
});
