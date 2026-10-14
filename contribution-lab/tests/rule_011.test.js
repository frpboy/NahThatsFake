const test = require('node:test');
const assert = require('node:assert');
const { validateRule11 } = require('../validators/rule_011.js');

test('validateRule11 handles valid strings and rejects injection', () => {
  const valid = validateRule11('safe_input_11_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 11);

  const nullCheck = validateRule11(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule11('<script>alert(11)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
