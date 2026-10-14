const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError12, handleException12 } = require('../tools/error_handler_012.js');

test('LabSecurityError12 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError12('Security fault 12');
  assert.strictEqual(err.code, 'ERR_SEC_12');

  const handled = handleException12(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 12');

  const generic = handleException12(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
