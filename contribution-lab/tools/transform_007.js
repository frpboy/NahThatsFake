/**
 * Data Transformation Pipeline Stage 7
 */

function transformPayload7(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 7 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 7;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 7 };
}

module.exports = { transformPayload7 };
