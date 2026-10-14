const test = require('node:test');
const assert = require('node:assert');
const { validateRule25 } = require('../validators/rule_025.js');

test('validateRule25 handles valid strings and rejects injection', () => {
  const valid = validateRule25('safe_input_25_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 25);

  const nullCheck = validateRule25(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule25('<script>alert(25)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
