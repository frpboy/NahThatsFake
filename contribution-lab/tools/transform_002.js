/**
 * Data Transformation Pipeline Stage 2
 */

function transformPayload2(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 2 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 2;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 2 };
}

module.exports = { transformPayload2 };
