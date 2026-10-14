const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError27, handleException27 } = require('../tools/error_handler_027.js');

test('LabSecurityError27 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError27('Security fault 27');
  assert.strictEqual(err.code, 'ERR_SEC_27');

  const handled = handleException27(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 27');

  const generic = handleException27(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
