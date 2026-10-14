const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError23, handleException23 } = require('../tools/error_handler_023.js');

test('LabSecurityError23 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError23('Security fault 23');
  assert.strictEqual(err.code, 'ERR_SEC_23');

  const handled = handleException23(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 23');

  const generic = handleException23(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
