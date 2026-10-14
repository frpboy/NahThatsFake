const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError24, handleException24 } = require('../tools/error_handler_024.js');

test('LabSecurityError24 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError24('Security fault 24');
  assert.strictEqual(err.code, 'ERR_SEC_24');

  const handled = handleException24(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 24');

  const generic = handleException24(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
