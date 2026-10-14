const test = require('node:test');
const assert = require('node:assert');
const { validateRule38 } = require('../validators/rule_038.js');

test('validateRule38 handles valid strings and rejects injection', () => {
  const valid = validateRule38('safe_input_38_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 38);

  const nullCheck = validateRule38(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule38('<script>alert(38)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
