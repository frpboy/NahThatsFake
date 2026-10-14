const test = require('node:test');
const assert = require('node:assert');
const { validateRule1 } = require('../validators/rule_001.js');

test('validateRule1 handles valid strings and rejects injection', () => {
  const valid = validateRule1('safe_input_1_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 1);

  const nullCheck = validateRule1(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule1('<script>alert(1)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
