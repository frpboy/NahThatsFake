const test = require('node:test');
const assert = require('node:assert');
const { transformPayload38 } = require('../tools/transform_038.js');

test('transformPayload38 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_38', token: 'secret_val' };
  const res = transformPayload38(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 38);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload38(null);
  assert.strictEqual(invalid.success, false);
});
