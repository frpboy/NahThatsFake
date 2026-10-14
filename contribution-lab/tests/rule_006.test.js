const test = require('node:test');
const assert = require('node:assert');
const { validateRule6 } = require('../validators/rule_006.js');

test('validateRule6 handles valid strings and rejects injection', () => {
  const valid = validateRule6('safe_input_6_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 6);

  const nullCheck = validateRule6(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule6('<script>alert(6)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
