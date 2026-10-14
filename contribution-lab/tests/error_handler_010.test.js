const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError10, handleException10 } = require('../tools/error_handler_010.js');

test('LabSecurityError10 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError10('Security fault 10');
  assert.strictEqual(err.code, 'ERR_SEC_10');

  const handled = handleException10(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 10');

  const generic = handleException10(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
