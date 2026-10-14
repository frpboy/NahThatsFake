const test = require('node:test');
const assert = require('node:assert');
const { transformPayload3 } = require('../tools/transform_003.js');

test('transformPayload3 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_3', token: 'secret_val' };
  const res = transformPayload3(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 3);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload3(null);
  assert.strictEqual(invalid.success, false);
});
