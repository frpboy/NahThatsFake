const test = require('node:test');
const assert = require('node:assert');
const { transformPayload25 } = require('../tools/transform_025.js');

test('transformPayload25 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_25', token: 'secret_val' };
  const res = transformPayload25(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 25);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload25(null);
  assert.strictEqual(invalid.success, false);
});
