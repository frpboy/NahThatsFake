const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError14, handleException14 } = require('../tools/error_handler_014.js');

test('LabSecurityError14 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError14('Security fault 14');
  assert.strictEqual(err.code, 'ERR_SEC_14');

  const handled = handleException14(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 14');

  const generic = handleException14(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
