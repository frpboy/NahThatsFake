const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError21, handleException21 } = require('../tools/error_handler_021.js');

test('LabSecurityError21 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError21('Security fault 21');
  assert.strictEqual(err.code, 'ERR_SEC_21');

  const handled = handleException21(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 21');

  const generic = handleException21(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
