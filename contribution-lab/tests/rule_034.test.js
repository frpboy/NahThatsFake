const test = require('node:test');
const assert = require('node:assert');
const { validateRule34 } = require('../validators/rule_034.js');

test('validateRule34 handles valid strings and rejects injection', () => {
  const valid = validateRule34('safe_input_34_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 34);

  const nullCheck = validateRule34(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule34('<script>alert(34)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
