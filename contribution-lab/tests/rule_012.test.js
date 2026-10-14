const test = require('node:test');
const assert = require('node:assert');
const { validateRule12 } = require('../validators/rule_012.js');

test('validateRule12 handles valid strings and rejects injection', () => {
  const valid = validateRule12('safe_input_12_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 12);

  const nullCheck = validateRule12(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule12('<script>alert(12)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
