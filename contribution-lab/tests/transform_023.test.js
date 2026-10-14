const test = require('node:test');
const assert = require('node:assert');
const { transformPayload23 } = require('../tools/transform_023.js');

test('transformPayload23 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_23', token: 'secret_val' };
  const res = transformPayload23(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 23);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload23(null);
  assert.strictEqual(invalid.success, false);
});
