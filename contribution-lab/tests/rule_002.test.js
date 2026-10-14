const test = require('node:test');
const assert = require('node:assert');
const { validateRule2 } = require('../validators/rule_002.js');

test('validateRule2 handles valid strings and rejects injection', () => {
  const valid = validateRule2('safe_input_2_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 2);

  const nullCheck = validateRule2(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule2('<script>alert(2)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
