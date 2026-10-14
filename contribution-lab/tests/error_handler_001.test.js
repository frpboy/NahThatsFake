const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError1, handleException1 } = require('../tools/error_handler_001.js');

test('LabSecurityError1 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError1('Security fault 1');
  assert.strictEqual(err.code, 'ERR_SEC_1');

  const handled = handleException1(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 1');

  const generic = handleException1(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
