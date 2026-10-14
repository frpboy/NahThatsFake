const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError18, handleException18 } = require('../tools/error_handler_018.js');

test('LabSecurityError18 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError18('Security fault 18');
  assert.strictEqual(err.code, 'ERR_SEC_18');

  const handled = handleException18(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 18');

  const generic = handleException18(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
