const test = require('node:test');
const assert = require('node:assert');
const { transformPayload48 } = require('../tools/transform_048.js');

test('transformPayload48 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_48', token: 'secret_val' };
  const res = transformPayload48(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 48);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload48(null);
  assert.strictEqual(invalid.success, false);
});
