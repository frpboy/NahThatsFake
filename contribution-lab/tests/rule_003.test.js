const test = require('node:test');
const assert = require('node:assert');
const { validateRule3 } = require('../validators/rule_003.js');

test('validateRule3 handles valid strings and rejects injection', () => {
  const valid = validateRule3('safe_input_3_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 3);

  const nullCheck = validateRule3(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule3('<script>alert(3)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
