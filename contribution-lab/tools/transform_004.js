/**
 * Data Transformation Pipeline Stage 4
 */

function transformPayload4(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 4 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 4;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 4 };
}

module.exports = { transformPayload4 };
