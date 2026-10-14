const test = require('node:test');
const assert = require('node:assert');
const { validateRule9 } = require('../validators/rule_009.js');

test('validateRule9 handles valid strings and rejects injection', () => {
  const valid = validateRule9('safe_input_9_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 9);

  const nullCheck = validateRule9(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule9('<script>alert(9)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
