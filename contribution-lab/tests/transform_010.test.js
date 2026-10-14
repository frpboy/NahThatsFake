const test = require('node:test');
const assert = require('node:assert');
const { transformPayload10 } = require('../tools/transform_010.js');

test('transformPayload10 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_10', token: 'secret_val' };
  const res = transformPayload10(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 10);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload10(null);
  assert.strictEqual(invalid.success, false);
});
