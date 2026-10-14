const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError16, handleException16 } = require('../tools/error_handler_016.js');

test('LabSecurityError16 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError16('Security fault 16');
  assert.strictEqual(err.code, 'ERR_SEC_16');

  const handled = handleException16(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 16');

  const generic = handleException16(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
