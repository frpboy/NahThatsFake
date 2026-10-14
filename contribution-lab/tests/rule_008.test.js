const test = require('node:test');
const assert = require('node:assert');
const { validateRule8 } = require('../validators/rule_008.js');

test('validateRule8 handles valid strings and rejects injection', () => {
  const valid = validateRule8('safe_input_8_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 8);

  const nullCheck = validateRule8(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule8('<script>alert(8)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
