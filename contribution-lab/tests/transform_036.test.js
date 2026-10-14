const test = require('node:test');
const assert = require('node:assert');
const { transformPayload36 } = require('../tools/transform_036.js');

test('transformPayload36 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_36', token: 'secret_val' };
  const res = transformPayload36(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 36);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload36(null);
  assert.strictEqual(invalid.success, false);
});
