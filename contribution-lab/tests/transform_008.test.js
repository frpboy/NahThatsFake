const test = require('node:test');
const assert = require('node:assert');
const { transformPayload8 } = require('../tools/transform_008.js');

test('transformPayload8 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_8', token: 'secret_val' };
  const res = transformPayload8(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 8);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload8(null);
  assert.strictEqual(invalid.success, false);
});
