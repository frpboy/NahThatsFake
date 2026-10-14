const test = require('node:test');
const assert = require('node:assert');
const { validateRule26 } = require('../validators/rule_026.js');

test('validateRule26 handles valid strings and rejects injection', () => {
  const valid = validateRule26('safe_input_26_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 26);

  const nullCheck = validateRule26(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule26('<script>alert(26)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
