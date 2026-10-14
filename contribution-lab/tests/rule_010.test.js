const test = require('node:test');
const assert = require('node:assert');
const { validateRule10 } = require('../validators/rule_010.js');

test('validateRule10 handles valid strings and rejects injection', () => {
  const valid = validateRule10('safe_input_10_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 10);

  const nullCheck = validateRule10(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule10('<script>alert(10)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
