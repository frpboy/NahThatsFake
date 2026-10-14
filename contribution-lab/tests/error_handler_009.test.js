const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError9, handleException9 } = require('../tools/error_handler_009.js');

test('LabSecurityError9 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError9('Security fault 9');
  assert.strictEqual(err.code, 'ERR_SEC_9');

  const handled = handleException9(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 9');

  const generic = handleException9(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
