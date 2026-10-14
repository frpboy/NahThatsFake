const test = require('node:test');
const assert = require('node:assert');
const { validateRule24 } = require('../validators/rule_024.js');

test('validateRule24 handles valid strings and rejects injection', () => {
  const valid = validateRule24('safe_input_24_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 24);

  const nullCheck = validateRule24(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule24('<script>alert(24)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
