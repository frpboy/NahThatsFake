const test = require('node:test');
const assert = require('node:assert');
const { transformPayload4 } = require('../tools/transform_004.js');

test('transformPayload4 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_4', token: 'secret_val' };
  const res = transformPayload4(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 4);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload4(null);
  assert.strictEqual(invalid.success, false);
});
