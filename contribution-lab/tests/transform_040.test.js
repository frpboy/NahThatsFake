const test = require('node:test');
const assert = require('node:assert');
const { transformPayload40 } = require('../tools/transform_040.js');

test('transformPayload40 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_40', token: 'secret_val' };
  const res = transformPayload40(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 40);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload40(null);
  assert.strictEqual(invalid.success, false);
});
