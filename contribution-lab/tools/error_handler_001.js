/**
 * Custom Error Boundary and Recovery Handler 1
 */

class LabSecurityError1 extends Error {
  constructor(message, code = 'ERR_SEC_1') {
    super(message);
    this.name = 'LabSecurityError1';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException1(err, fallbackVal = null) {
  if (err instanceof LabSecurityError1) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError1, handleException1 };
