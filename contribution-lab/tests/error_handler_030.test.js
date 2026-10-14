const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError30, handleException30 } = require('../tools/error_handler_030.js');

test('LabSecurityError30 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError30('Security fault 30');
  assert.strictEqual(err.code, 'ERR_SEC_30');

  const handled = handleException30(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 30');

  const generic = handleException30(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
