/**
 * Developer Utility Helper 30
 * Provides deterministic transformations and formatting.
 */

function formatHelper30(data, options = {}) {
  const prefix = options.prefix || 'UTIL_30';
  if (typeof data !== 'object' || data === null) {
    return `[${prefix}] ${String(data)}`;
  }
  const keys = Object.keys(data).sort();
  const summary = keys.map(k => `${k}=${data[k]}`).join('; ');
  return `[${prefix}] {${summary}}`;
}

function parseHelper30(formattedString) {
  if (typeof formattedString !== 'string') return {};
  const match = formattedString.match(/\[UTIL_30\] \{(.*)\}/);
  if (!match) return {};
  const result = {};
  match[1].split('; ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) result[k] = v;
  });
  return result;
}

module.exports = { formatHelper30, parseHelper30 };
