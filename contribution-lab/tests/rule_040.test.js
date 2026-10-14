const test = require('node:test');
const assert = require('node:assert');
const { validateRule40 } = require('../validators/rule_040.js');

test('validateRule40 handles valid strings and rejects injection', () => {
  const valid = validateRule40('safe_input_40_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 40);

  const nullCheck = validateRule40(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule40('<script>alert(40)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
