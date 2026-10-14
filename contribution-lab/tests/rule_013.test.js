const test = require('node:test');
const assert = require('node:assert');
const { validateRule13 } = require('../validators/rule_013.js');

test('validateRule13 handles valid strings and rejects injection', () => {
  const valid = validateRule13('safe_input_13_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 13);

  const nullCheck = validateRule13(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule13('<script>alert(13)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
