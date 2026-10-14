const test = require('node:test');
const assert = require('node:assert');
const { transformPayload50 } = require('../tools/transform_050.js');

test('transformPayload50 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_50', token: 'secret_val' };
  const res = transformPayload50(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 50);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload50(null);
  assert.strictEqual(invalid.success, false);
});
