const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError26, handleException26 } = require('../tools/error_handler_026.js');

test('LabSecurityError26 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError26('Security fault 26');
  assert.strictEqual(err.code, 'ERR_SEC_26');

  const handled = handleException26(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 26');

  const generic = handleException26(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
