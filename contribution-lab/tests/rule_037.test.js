const test = require('node:test');
const assert = require('node:assert');
const { validateRule37 } = require('../validators/rule_037.js');

test('validateRule37 handles valid strings and rejects injection', () => {
  const valid = validateRule37('safe_input_37_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 37);

  const nullCheck = validateRule37(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule37('<script>alert(37)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
