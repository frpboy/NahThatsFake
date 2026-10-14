const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError22, handleException22 } = require('../tools/error_handler_022.js');

test('LabSecurityError22 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError22('Security fault 22');
  assert.strictEqual(err.code, 'ERR_SEC_22');

  const handled = handleException22(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 22');

  const generic = handleException22(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
