const test = require('node:test');
const assert = require('node:assert');
const { validateRule29 } = require('../validators/rule_029.js');

test('validateRule29 handles valid strings and rejects injection', () => {
  const valid = validateRule29('safe_input_29_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 29);

  const nullCheck = validateRule29(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule29('<script>alert(29)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
