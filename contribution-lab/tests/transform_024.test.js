const test = require('node:test');
const assert = require('node:assert');
const { transformPayload24 } = require('../tools/transform_024.js');

test('transformPayload24 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_24', token: 'secret_val' };
  const res = transformPayload24(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 24);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload24(null);
  assert.strictEqual(invalid.success, false);
});
