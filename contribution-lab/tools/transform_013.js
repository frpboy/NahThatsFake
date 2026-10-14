/**
 * Data Transformation Pipeline Stage 13
 */

function transformPayload13(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 13 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 13;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 13 };
}

module.exports = { transformPayload13 };
