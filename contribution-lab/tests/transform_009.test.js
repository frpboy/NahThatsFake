const test = require('node:test');
const assert = require('node:assert');
const { transformPayload9 } = require('../tools/transform_009.js');

test('transformPayload9 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_9', token: 'secret_val' };
  const res = transformPayload9(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 9);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload9(null);
  assert.strictEqual(invalid.success, false);
});
