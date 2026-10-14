const test = require('node:test');
const assert = require('node:assert');
const { validateRule16 } = require('../validators/rule_016.js');

test('validateRule16 handles valid strings and rejects injection', () => {
  const valid = validateRule16('safe_input_16_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 16);

  const nullCheck = validateRule16(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule16('<script>alert(16)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
