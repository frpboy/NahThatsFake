const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError20, handleException20 } = require('../tools/error_handler_020.js');

test('LabSecurityError20 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError20('Security fault 20');
  assert.strictEqual(err.code, 'ERR_SEC_20');

  const handled = handleException20(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 20');

  const generic = handleException20(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
