/**
 * Data Transformation Pipeline Stage 36
 */

function transformPayload36(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 36 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 36;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 36 };
}

module.exports = { transformPayload36 };
