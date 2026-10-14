const test = require('node:test');
const assert = require('node:assert');
const { validateRule23 } = require('../validators/rule_023.js');

test('validateRule23 handles valid strings and rejects injection', () => {
  const valid = validateRule23('safe_input_23_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 23);

  const nullCheck = validateRule23(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule23('<script>alert(23)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
