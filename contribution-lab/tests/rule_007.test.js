const test = require('node:test');
const assert = require('node:assert');
const { validateRule7 } = require('../validators/rule_007.js');

test('validateRule7 handles valid strings and rejects injection', () => {
  const valid = validateRule7('safe_input_7_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 7);

  const nullCheck = validateRule7(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule7('<script>alert(7)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
