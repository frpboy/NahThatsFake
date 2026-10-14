const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError25, handleException25 } = require('../tools/error_handler_025.js');

test('LabSecurityError25 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError25('Security fault 25');
  assert.strictEqual(err.code, 'ERR_SEC_25');

  const handled = handleException25(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 25');

  const generic = handleException25(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
