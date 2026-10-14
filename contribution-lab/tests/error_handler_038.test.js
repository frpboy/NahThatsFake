const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError38, handleException38 } = require('../tools/error_handler_038.js');

test('LabSecurityError38 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError38('Security fault 38');
  assert.strictEqual(err.code, 'ERR_SEC_38');

  const handled = handleException38(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 38');

  const generic = handleException38(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
