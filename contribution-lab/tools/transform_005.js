/**
 * Data Transformation Pipeline Stage 5
 */

function transformPayload5(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 5 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 5;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 5 };
}

module.exports = { transformPayload5 };
