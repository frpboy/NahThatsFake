const test = require('node:test');
const assert = require('node:assert');
const { validateRule17 } = require('../validators/rule_017.js');

test('validateRule17 handles valid strings and rejects injection', () => {
  const valid = validateRule17('safe_input_17_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 17);

  const nullCheck = validateRule17(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule17('<script>alert(17)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
