/**
 * Developer Utility Helper 12
 * Provides deterministic transformations and formatting.
 */

function formatHelper12(data, options = {}) {
  const prefix = options.prefix || 'UTIL_12';
  if (typeof data !== 'object' || data === null) {
    return `[${prefix}] ${String(data)}`;
  }
  const keys = Object.keys(data).sort();
  const summary = keys.map(k => `${k}=${data[k]}`).join('; ');
  return `[${prefix}] {${summary}}`;
}

function parseHelper12(formattedString) {
  if (typeof formattedString !== 'string') return {};
  const match = formattedString.match(/\[UTIL_12\] \{(.*)\}/);
  if (!match) return {};
  const result = {};
  match[1].split('; ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) result[k] = v;
  });
  return result;
}

module.exports = { formatHelper12, parseHelper12 };
