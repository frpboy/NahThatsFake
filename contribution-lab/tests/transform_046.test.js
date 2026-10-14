const test = require('node:test');
const assert = require('node:assert');
const { transformPayload46 } = require('../tools/transform_046.js');

test('transformPayload46 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_46', token: 'secret_val' };
  const res = transformPayload46(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 46);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload46(null);
  assert.strictEqual(invalid.success, false);
});
