const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError35, handleException35 } = require('../tools/error_handler_035.js');

test('LabSecurityError35 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError35('Security fault 35');
  assert.strictEqual(err.code, 'ERR_SEC_35');

  const handled = handleException35(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 35');

  const generic = handleException35(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
