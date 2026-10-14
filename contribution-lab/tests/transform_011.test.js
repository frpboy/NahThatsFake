const test = require('node:test');
const assert = require('node:assert');
const { transformPayload11 } = require('../tools/transform_011.js');

test('transformPayload11 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_11', token: 'secret_val' };
  const res = transformPayload11(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 11);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload11(null);
  assert.strictEqual(invalid.success, false);
});
