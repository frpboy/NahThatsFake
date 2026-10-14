const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError3, handleException3 } = require('../tools/error_handler_003.js');

test('LabSecurityError3 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError3('Security fault 3');
  assert.strictEqual(err.code, 'ERR_SEC_3');

  const handled = handleException3(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 3');

  const generic = handleException3(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
