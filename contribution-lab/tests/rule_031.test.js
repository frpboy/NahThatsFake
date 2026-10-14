const test = require('node:test');
const assert = require('node:assert');
const { validateRule31 } = require('../validators/rule_031.js');

test('validateRule31 handles valid strings and rejects injection', () => {
  const valid = validateRule31('safe_input_31_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 31);

  const nullCheck = validateRule31(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule31('<script>alert(31)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
