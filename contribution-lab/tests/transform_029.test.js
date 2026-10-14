const test = require('node:test');
const assert = require('node:assert');
const { transformPayload29 } = require('../tools/transform_029.js');

test('transformPayload29 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_29', token: 'secret_val' };
  const res = transformPayload29(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 29);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload29(null);
  assert.strictEqual(invalid.success, false);
});
