const test = require('node:test');
const assert = require('node:assert');
const { LabSecurityError11, handleException11 } = require('../tools/error_handler_011.js');

test('LabSecurityError11 captures code and handles graceful recovery', () => {
  const err = new LabSecurityError11('Security fault 11');
  assert.strictEqual(err.code, 'ERR_SEC_11');

  const handled = handleException11(err, { default: true });
  assert.strictEqual(handled.recovered, true);
  assert.strictEqual(handled.message, 'Security fault 11');

  const generic = handleException11(new Error('generic err'));
  assert.strictEqual(generic.recovered, false);
});
