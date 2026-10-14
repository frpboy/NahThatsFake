const test = require('node:test');
const assert = require('node:assert');
const { validateRule28 } = require('../validators/rule_028.js');

test('validateRule28 handles valid strings and rejects injection', () => {
  const valid = validateRule28('safe_input_28_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 28);

  const nullCheck = validateRule28(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule28('<script>alert(28)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
