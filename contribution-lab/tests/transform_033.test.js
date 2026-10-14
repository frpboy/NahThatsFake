const test = require('node:test');
const assert = require('node:assert');
const { transformPayload33 } = require('../tools/transform_033.js');

test('transformPayload33 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_33', token: 'secret_val' };
  const res = transformPayload33(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 33);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload33(null);
  assert.strictEqual(invalid.success, false);
});
