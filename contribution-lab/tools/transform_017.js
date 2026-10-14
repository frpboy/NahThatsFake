/**
 * Data Transformation Pipeline Stage 17
 */

function transformPayload17(rawRecord, config = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return { success: false, data: null, stage: 17 };
  }
  const cloned = { ...rawRecord };
  cloned.stageApplied = 17;
  cloned.processedAt = Date.now();
  if (config.maskSensitive) {
    if (cloned.token) cloned.token = '***REDACTED***';
    if (cloned.secret) cloned.secret = '***REDACTED***';
  }
  return { success: true, data: cloned, stage: 17 };
}

module.exports = { transformPayload17 };
