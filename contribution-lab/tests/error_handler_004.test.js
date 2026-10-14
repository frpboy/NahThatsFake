const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError4, handleException4 } = require('../tools/error_handler_004.js');

test('LabSecurityError4 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError4('Security fault 4');
  assert.strictEqual(err.code, 'ERR_SEC_4');

  const handled = handleException4(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 4');

  const generic = handleException4(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
