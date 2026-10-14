/**
 * Data Transformation Pipeline Stage 21
 */

function transformPayload21(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 21 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 21;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 21 };
}

module.exports = { transformPayload21 };
