const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError31, handleException31 } = require('../tools/error_handler_031.js');

test('LabSecurityError31 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError31('Security fault 31');
  assert.strictEqual(err.code, 'ERR_SEC_31');

  const handled = handleException31(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 31');

  const generic = handleException31(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
