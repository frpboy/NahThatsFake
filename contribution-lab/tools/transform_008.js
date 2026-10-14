/**
 * Data Transformation Pipeline Stage 8
 */

function transformPayload8(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 8 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 8;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 8 };
}

module.exports = { transformPayload8 };
