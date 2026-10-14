const test = require('node:test');
const assert = require('node:assert');
const { transformPayload26 } = require('../tools/transform_026.js');

test('transformPayload26 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_26', token: 'secret_val' };
  const res = transformPayload26(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 26);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload26(null);
  assert.strictEqual(invalid.success, false);
});
