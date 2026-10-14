const test = require('node:test');
const assert = require('node:assert');
const { transformPayload37 } = require('../tools/transform_037.js');

test('transformPayload37 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_37', token: 'secret_val' };
  const res = transformPayload37(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 37);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload37(null);
  assert.strictEqual(invalid.success, false);
});
