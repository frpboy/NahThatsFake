const test = require('node:test');
const assert = require('node:assert');
const { validateRule22 } = require('../validators/rule_022.js');

test('validateRule22 handles valid strings and rejects injection', () => {
  const valid = validateRule22('safe_input_22_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 22);

  const nullCheck = validateRule22(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule22('<script>alert(22)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
