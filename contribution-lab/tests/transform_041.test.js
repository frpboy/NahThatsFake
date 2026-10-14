const test = require('node:test');
const assert = require('node:assert');
const { transformPayload41 } = require('../tools/transform_041.js');

test('transformPayload41 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_41', token: 'secret_val' };
  const res = transformPayload41(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 41);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload41(null);
  assert.strictEqual(invalid.success, false);
});
