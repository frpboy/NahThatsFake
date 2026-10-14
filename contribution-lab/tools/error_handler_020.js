/**
 * Custom Error Boundary and Recovery Handler 20
 */

class LabSecurityError20 extends Error {
  constructor(message, code = 'ERR_SEC_20') {
    super(message);
    this.name = 'LabSecurityError20';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException20(err, fallbackVal = null) {
  if (err instanceof LabSecurityError20) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError20, handleException20 };
