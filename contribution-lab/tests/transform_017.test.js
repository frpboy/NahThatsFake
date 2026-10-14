const test = require('node:test');
const assert = require('node:assert');
const { transformPayload17 } = require('../tools/transform_017.js');

test('transformPayload17 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_17', token: 'secret_val' };
  const res = transformPayload17(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 17);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload17(null);
  assert.strictEqual(invalid.success, false);
});
