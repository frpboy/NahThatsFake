const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError5, handleException5 } = require('../tools/error_handler_005.js');

test('LabSecurityError5 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError5('Security fault 5');
  assert.strictEqual(err.code, 'ERR_SEC_5');

  const handled = handleException5(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 5');

  const generic = handleException5(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
