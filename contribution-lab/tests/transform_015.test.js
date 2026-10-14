const test = require('node:test');
const assert = require('node:assert');
const { transformPayload15 } = require('../tools/transform_015.js');

test('transformPayload15 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_15', token: 'secret_val' };
  const res = transformPayload15(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 15);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload15(null);
  assert.strictEqual(invalid.success, false);
});
