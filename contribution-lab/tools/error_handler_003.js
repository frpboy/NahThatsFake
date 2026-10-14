/**
 * Custom Error Boundary and Recovery Handler 3
 */

class LabSecurityError3 extends Error {
  constructor(message, code = 'ERR_SEC_3') {
    super(message);
    this.name = 'LabSecurityError3';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException3(err, fallbackVal = null) {
  if (err instanceof LabSecurityError3) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError3, handleException3 };
