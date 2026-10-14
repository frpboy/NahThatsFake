/**
 * Data Transformation Pipeline Stage 1
 */

function transformPayload1(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 1 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 1;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 1 };
}

module.exports = { transformPayload1 };
