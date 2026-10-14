/**
 * Custom Error Boundary and Recovery Handler 2
 */

class LabSecurityError2 extends Error {
  constructor(message, code = 'ERR_SEC_2') {
    super(message);
    this.name = 'LabSecurityError2';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException2(err, fallbackVal = null) {
  if (err instanceof LabSecurityError2) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError2, handleException2 };
