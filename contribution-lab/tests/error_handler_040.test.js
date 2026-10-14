const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError40, handleException40 } = require('../tools/error_handler_040.js');

test('LabSecurityError40 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError40('Security fault 40');
  assert.strictEqual(err.code, 'ERR_SEC_40');

  const handled = handleException40(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 40');

  const generic = handleException40(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
