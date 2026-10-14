/**
 * Data Transformation Pipeline Stage 14
 */

function transformPayload14(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 14 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 14;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 14 };
}

module.exports = { transformPayload14 };
