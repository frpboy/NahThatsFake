/**
 * Data Transformation Pipeline Stage 6
 */

function transformPayload6(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 6 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 6;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 6 };
}

module.exports = { transformPayload6 };
