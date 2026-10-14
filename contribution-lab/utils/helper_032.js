/**
 * Developer Utility Helper 32
 * Provides deterministic transformations and formatting.
 */

function formatHelper32(data, options = {}) {
  const prefix = options.prefix || 'UTIL_32';
  if (typeof data !== 'object' || data === null) {
    return `[${prefix}] ${String(data)}`;
  }
  const keys = Object.keys(data).sort();
  const summary = keys.map(k => `${k}=${data[k]}`).join('; ');
  return `[${prefix}] {${summary}}`;
}

function parseHelper32(formattedString) {
  if (typeof formattedString !== 'string') return {};
  const match = formattedString.match(/\[UTIL_32\] \{(.*)\}/);
  if (!match) return {};
  const result = {};
  match[1].split('; ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) result[k] = v;
  });
  return result;
}

module.exports = { formatHelper32, parseHelper32 };
