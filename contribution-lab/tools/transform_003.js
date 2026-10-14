/**
 * Data Transformation Pipeline Stage 3
 */

function transformPayload3(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 3 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 3;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 3 };
}

module.exports = { transformPayload3 };
