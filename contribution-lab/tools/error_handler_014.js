/**
 * Custom Error Boundary and Recovery Handler 14
 */

class LabSecurityError14 extends Error {
  constructor(message, code = 'ERR_SEC_14') {
    super(message);
    this.name = 'LabSecurityError14';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException14(err, fallbackVal = null) {
  if (err instanceof LabSecurityError14) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError14, handleException14 };
