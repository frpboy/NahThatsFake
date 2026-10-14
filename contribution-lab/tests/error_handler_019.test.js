const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError19, handleException19 } = require('../tools/error_handler_019.js');

test('LabSecurityError19 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError19('Security fault 19');
  assert.strictEqual(err.code, 'ERR_SEC_19');

  const handled = handleException19(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 19');

  const generic = handleException19(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
