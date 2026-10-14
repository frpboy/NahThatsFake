const test = require('node:test');
const assert = require('node:assert');
const { validateRule14 } = require('../validators/rule_014.js');

test('validateRule14 handles valid strings and rejects injection', () => {
  const valid = validateRule14('safe_input_14_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 14);

  const nullCheck = validateRule14(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule14('<script>alert(14)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
