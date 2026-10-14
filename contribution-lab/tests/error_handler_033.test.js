const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError33, handleException33 } = require('../tools/error_handler_033.js');

test('LabSecurityError33 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError33('Security fault 33');
  assert.strictEqual(err.code, 'ERR_SEC_33');

  const handled = handleException33(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 33');

  const generic = handleException33(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
