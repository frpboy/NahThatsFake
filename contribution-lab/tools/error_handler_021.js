/**
 * Custom Error Boundary and Recovery Handler 21
 */

class LabSecurityError21 extends Error {
  constructor(message, code = 'ERR_SEC_21') {
    super(message);
    this.name = 'LabSecurityError21';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException21(err, fallbackVal = null) {
  if (err instanceof LabSecurityError21) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError21, handleException21 };
