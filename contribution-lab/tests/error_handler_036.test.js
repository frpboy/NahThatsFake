const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError36, handleException36 } = require('../tools/error_handler_036.js');

test('LabSecurityError36 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError36('Security fault 36');
  assert.strictEqual(err.code, 'ERR_SEC_36');

  const handled = handleException36(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 36');

  const generic = handleException36(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
