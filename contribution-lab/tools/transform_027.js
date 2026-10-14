/**
 * Data Transformation Pipeline Stage 27
 */

function transformPayload27(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 27 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 27;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 27 };
}

module.exports = { transformPayload27 };
