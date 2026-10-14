/**
 * Data Sanitizer & Token Normalizer 32
 */

function sanitizeInput32(rawInput) {
  if (typeof rawInput !== 'string') {
    return { sanitized: '', length: 0, flags: ['NON_STRING_INPUT'] };
  }
  const flags = [];
  let clean = rawInput.trim();
  if (clean.length > 500) {
    clean = clean.substring(0, 500);
    flags.push('TRUNCATED');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(clean)) {
    clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    flags.push('CONTROL_CHARS_REMOVED');
  }
  return {
    sanitizerId: 32,
    sanitized: clean,
    length: clean.length,
    flags
  };
}

module.exports = { sanitizeInput32 };
