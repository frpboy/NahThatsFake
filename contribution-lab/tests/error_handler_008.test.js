const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError8, handleException8 } = require('../tools/error_handler_008.js');

test('LabSecurityError8 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError8('Security fault 8');
  assert.strictEqual(err.code, 'ERR_SEC_8');

  const handled = handleException8(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 8');

  const generic = handleException8(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
