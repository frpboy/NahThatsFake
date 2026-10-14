/**
 * Custom Error Boundary and Recovery Handler 40
 */

class LabSecurityError40 extends Error {
  constructor(message, code = 'ERR_SEC_40') {
    super(message);
    this.name = 'LabSecurityError40';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException40(err, fallbackVal = null) {
  if (err instanceof LabSecurityError40) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError40, handleException40 };
