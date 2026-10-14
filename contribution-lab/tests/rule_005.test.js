const test = require('node:test');
const assert = require('node:assert');
const { validateRule5 } = require('../validators/rule_005.js');

test('validateRule5 handles valid strings and rejects injection', () => {
  const valid = validateRule5('safe_input_5_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 5);

  const nullCheck = validateRule5(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule5('<script>alert(5)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
