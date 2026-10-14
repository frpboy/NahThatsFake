const test = require('node:test');
const assert = require('node:assert');
const { transformPayload47 } = require('../tools/transform_047.js');

test('transformPayload47 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_47', token: 'secret_val' };
  const res = transformPayload47(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 47);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload47(null);
  assert.strictEqual(invalid.success, false);
});
