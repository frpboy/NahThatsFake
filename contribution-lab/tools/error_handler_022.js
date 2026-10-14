/**
 * Custom Error Boundary and Recovery Handler 22
 */

class LabSecurityError22 extends Error {
  constructor(message, code = 'ERR_SEC_22') {
    super(message);
    this.name = 'LabSecurityError22';
    this.code = code;
    this.timestamp = Date.now();
  }
}

function handleException22(err, fallbackVal = null) {
  if (err instanceof LabSecurityError22) {
    return { recovered: true, code: err.code, message: err.message, fallback: fallbackVal };
  }
  return { recovered: false, error: err ? err.message : 'Unknown exception' };
}

module.exports = { LabSecurityError22, handleException22 };
