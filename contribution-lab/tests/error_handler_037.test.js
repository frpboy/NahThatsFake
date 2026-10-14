const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError37, handleException37 } = require('../tools/error_handler_037.js');

test('LabSecurityError37 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError37('Security fault 37');
  assert.strictEqual(err.code, 'ERR_SEC_37');

  const handled = handleException37(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 37');

  const generic = handleException37(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
