const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError17, handleException17 } = require('../tools/error_handler_017.js');

test('LabSecurityError17 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError17('Security fault 17');
  assert.strictEqual(err.code, 'ERR_SEC_17');

  const handled = handleException17(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 17');

  const generic = handleException17(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
