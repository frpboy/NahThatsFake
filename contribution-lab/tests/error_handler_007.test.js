const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError7, handleException7 } = require('../tools/error_handler_007.js');

test('LabSecurityError7 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError7('Security fault 7');
  assert.strictEqual(err.code, 'ERR_SEC_7');

  const handled = handleException7(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 7');

  const generic = handleException7(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
