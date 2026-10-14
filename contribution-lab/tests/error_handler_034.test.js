const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError34, handleException34 } = require('../tools/error_handler_034.js');

test('LabSecurityError34 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError34('Security fault 34');
  assert.strictEqual(err.code, 'ERR_SEC_34');

  const handled = handleException34(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 34');

  const generic = handleException34(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
