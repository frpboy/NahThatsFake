/**
 * Data Transformation Pipeline Stage 25
 */

function transformPayload25(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 25 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 25;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 25 };
}

module.exports = { transformPayload25 };
