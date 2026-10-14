const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError2, handleException2 } = require('../tools/error_handler_002.js');

test('LabSecurityError2 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError2('Security fault 2');
  assert.strictEqual(err.code, 'ERR_SEC_2');

  const handled = handleException2(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 2');

  const generic = handleException2(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
