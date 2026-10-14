const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError39, handleException39 } = require('../tools/error_handler_039.js');

test('LabSecurityError39 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError39('Security fault 39');
  assert.strictEqual(err.code, 'ERR_SEC_39');

  const handled = handleException39(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 39');

  const generic = handleException39(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
