const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError32, handleException32 } = require('../tools/error_handler_032.js');

test('LabSecurityError32 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError32('Security fault 32');
  assert.strictEqual(err.code, 'ERR_SEC_32');

  const handled = handleException32(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 32');

  const generic = handleException32(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
