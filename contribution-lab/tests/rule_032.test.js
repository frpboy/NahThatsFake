const test = require('node:test');
const assert = require('node:assert');
const { validateRule32 } = require('../validators/rule_032.js');

test('validateRule32 handles valid strings and rejects injection', () => {
  const valid = validateRule32('safe_input_32_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 32);

  const nullCheck = validateRule32(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule32('<script>alert(32)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
