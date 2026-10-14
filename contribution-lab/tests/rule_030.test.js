const test = require('node:test');
const assert = require('node:assert');
const { validateRule30 } = require('../validators/rule_030.js');

test('validateRule30 handles valid strings and rejects injection', () => {
  const valid = validateRule30('safe_input_30_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 30);

  const nullCheck = validateRule30(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule30('<script>alert(30)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
