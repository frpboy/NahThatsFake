const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError6, handleException6 } = require('../tools/error_handler_006.js');

test('LabSecurityError6 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError6('Security fault 6');
  assert.strictEqual(err.code, 'ERR_SEC_6');

  const handled = handleException6(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 6');

  const generic = handleException6(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
