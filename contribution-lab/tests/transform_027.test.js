const test = require('node:test');
const assert = require('node:assert');
const { transformPayload27 } = require('../tools/transform_027.js');

test('transformPayload27 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_27', token: 'secret_val' };
  const res = transformPayload27(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 27);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload27(null);
  assert.strictEqual(invalid.success, false);
});
