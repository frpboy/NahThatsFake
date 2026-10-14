const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError28, handleException28 } = require('../tools/error_handler_028.js');

test('LabSecurityError28 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError28('Security fault 28');
  assert.strictEqual(err.code, 'ERR_SEC_28');

  const handled = handleException28(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 28');

  const generic = handleException28(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
