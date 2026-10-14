const test = require('node:test');
const assert = require('node:assert');
const { transformPayload1 } = require('../tools/transform_001.js');

test('transformPayload1 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_1', token: 'secret_val' };
  const res = transformPayload1(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 1);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload1(null);
  assert.strictEqual(invalid.success, false);
});
