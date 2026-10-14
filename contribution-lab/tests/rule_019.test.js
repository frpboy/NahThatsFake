const test = require('node:test');
const assert = require('node:assert');
const { validateRule19 } = require('../validators/rule_019.js');

test('validateRule19 handles valid strings and rejects injection', () => {
  const valid = validateRule19('safe_input_19_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 19);

  const nullCheck = validateRule19(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule19('<script>alert(19)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
