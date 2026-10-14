const test = require('node:test');
const assert = require('node:assert');
const { validateRule33 } = require('../validators/rule_033.js');

test('validateRule33 handles valid strings and rejects injection', () => {
  const valid = validateRule33('safe_input_33_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 33);

  const nullCheck = validateRule33(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule33('<script>alert(33)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
