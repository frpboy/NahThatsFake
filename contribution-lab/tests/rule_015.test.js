const test = require('node:test');
const assert = require('node:assert');
const { validateRule15 } = require('../validators/rule_015.js');

test('validateRule15 handles valid strings and rejects injection', () => {
  const valid = validateRule15('safe_input_15_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 15);

  const nullCheck = validateRule15(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule15('<script>alert(15)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
