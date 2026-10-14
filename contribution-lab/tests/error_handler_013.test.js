const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError13, handleException13 } = require('../tools/error_handler_013.js');

test('LabSecurityError13 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError13('Security fault 13');
  assert.strictEqual(err.code, 'ERR_SEC_13');

  const handled = handleException13(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 13');

  const generic = handleException13(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
