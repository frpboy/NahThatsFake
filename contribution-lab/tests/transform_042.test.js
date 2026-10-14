const test = require('node:test');
const assert = require('node:assert');
const { transformPayload42 } = require('../tools/transform_042.js');

test('transformPayload42 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_42', token: 'secret_val' };
  const res = transformPayload42(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 42);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload42(null);
  assert.strictEqual(invalid.success, false);
});
