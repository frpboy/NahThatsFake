const test = require('node:test');
const assert = require('node:assert');
const { validateRule21 } = require('../validators/rule_021.js');

test('validateRule21 handles valid strings and rejects injection', () => {
  const valid = validateRule21('safe_input_21_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 21);

  const nullCheck = validateRule21(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule21('<script>alert(21)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
