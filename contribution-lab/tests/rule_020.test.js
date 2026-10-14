const test = require('node:test');
const assert = require('node:assert');
const { validateRule20 } = require('../validators/rule_020.js');

test('validateRule20 handles valid strings and rejects injection', () => {
  const valid = validateRule20('safe_input_20_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 20);

  const nullCheck = validateRule20(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule20('<script>alert(20)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
