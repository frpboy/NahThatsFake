const test = require('node:test');
const assert = require('node:assert');
const { validateRule36 } = require('../validators/rule_036.js');

test('validateRule36 handles valid strings and rejects injection', () => {
  const valid = validateRule36('safe_input_36_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 36);

  const nullCheck = validateRule36(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule36('<script>alert(36)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
