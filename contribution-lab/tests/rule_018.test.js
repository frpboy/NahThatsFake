const test = require('node:test');
const assert = require('node:assert');
const { validateRule18 } = require('../validators/rule_018.js');

test('validateRule18 handles valid strings and rejects injection', () => {
  const valid = validateRule18('safe_input_18_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 18);

  const nullCheck = validateRule18(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule18('<script>alert(18)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
