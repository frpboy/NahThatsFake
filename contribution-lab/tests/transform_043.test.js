const test = require('node:test');
const assert = require('node:assert');
const { transformPayload43 } = require('../tools/transform_043.js');

test('transformPayload43 applies stage metadata and masks sensitive tokens', () => {
  const input = { id: 'rec_43', token: 'secret_val' };
  const res = transformPayload43(input, { maskSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stage, 43);
  assert.strictEqual(res.data.token, '***REDACTED***');

  const invalid = transformPayload43(null);
  assert.strictEqual(invalid.success, false);
});
