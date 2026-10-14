const test = require('node:test');
const assert = require('node:assert');
const { transformPayload32 } = require('../tools/transform_032.js');

test('transformPayload32 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_32', token: 'secret_val' };
  const res = transformPayload32(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 32);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload32(null);
  assert.strictEqual(invalid.success, false);
});
