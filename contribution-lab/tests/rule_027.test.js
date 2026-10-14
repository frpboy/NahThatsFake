const test = require('node:test');
const assert = require('node:assert');
const { validateRule27 } = require('../validators/rule_027.js');

test('validateRule27 handles valid strings and rejects injection', () => {
  const valid = validateRule27('safe_input_27_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 27);

  const nullCheck = validateRule27(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule27('<script>alert(27)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
