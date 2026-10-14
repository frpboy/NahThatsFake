/**
 * Custom Error Boundary and Recovery Handler 15
 */

class LabSecurityError15 extends Error {
  constructor(message, code = 'ERR_SEC_15') {
    super(message);
    this.name = 'LabSecurityError15';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException15(err, fallbackVal = null) {
  if (err instanceof LabSecurityError15) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError15, handleException15 };
