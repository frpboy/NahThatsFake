const test = require('node:test');
const assert = require('node:assert');
const { validateRule4 } = require('../validators/rule_004.js');

test('validateRule4 handles valid strings and rejects injection', () => {
  const valid = validateRule4('safe_input_4_token');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.ruleId, 4);

  const nullCheck = validateRule4(null);
  assert.strictEqual(nullCheck.valid, false);

  const malicious = validateRule4('<script>alert(4)</script>');
  assert.strictEqual(malicious.valid, false);
  assert.strictEqual(malicious.sanitized.includes('<'), false);
});
