/**
 * Custom Error Boundary and Recovery Handler 12
 */

class LabSecurityError12 extends Error {
  constructor(message, code = 'ERR_SEC_12') {
    super(message);
    this.name = 'LabSecurityError12';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException12(err, fallbackVal = null) {
  if (err instanceof LabSecurityError12) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError12, handleException12 };
