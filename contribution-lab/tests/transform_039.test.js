const test = require('node:test');
const assert = require('node:assert');
const { transformPayload39 } = require('../tools/transform_039.js');

test('transformPayload39 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_39', token: 'secret_val' };
  const res = transformPayload39(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 39);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload39(null);
  assert.strictEqual(invalid.success, false);
});
