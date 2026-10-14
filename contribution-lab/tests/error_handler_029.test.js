const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError29, handleException29 } = require('../tools/error_handler_029.js');

test('LabSecurityError29 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError29('Security fault 29');
  assert.strictEqual(err.code, 'ERR_SEC_29');

  const handled = handleException29(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 29');

  const generic = handleException29(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
