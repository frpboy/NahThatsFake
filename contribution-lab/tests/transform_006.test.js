const test = require('node:test');
const assert = require('node:assert');
const { transformPayload6 } = require('../tools/transform_006.js');

test('transformPayload6 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_6', token: 'secret_val' };
  const res = transformPayload6(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 6);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload6(null);
  assert.strictEqual(invalid.success, false);
});
