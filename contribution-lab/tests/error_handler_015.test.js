const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError15, handleException15 } = require('../tools/error_handler_015.js');

test('LabSecurityError15 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError15('Security fault 15');
  assert.strictEqual(err.code, 'ERR_SEC_15');

  const handled = handleException15(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 15');

  const generic = handleException15(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
