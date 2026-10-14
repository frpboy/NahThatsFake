const test = require('node:test');
const assert = require('node:assert');
const { validateRule39 } = require('../validators/rule_039.js');

test('validateRule39 handles valid strings and rejects injection', () => {
  const valid = validateRule39('safe_input_39_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 39);

  const nullCheck = validateRule39(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule39('<script>alert(39)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
