const test = require('node:test');
const assert = require('node:assert');
const { validateRule35 } = require('../validators/rule_035.js');

test('validateRule35 handles valid strings and rejects injection', () => {
  const valid = validateRule35('safe_input_35_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 35);

  const nullCheck = validateRule35(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule35('<script>alert(35)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
