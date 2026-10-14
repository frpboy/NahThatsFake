/**
 * Developer Utility Helper 17
 * Provides deterministic transformations and formatting.
 */

function formatHelper17(data, options = {}) {
  const prefix = options.prefix || 'UTIL_17';
  if (typeof data !== 'object' || data === null) {
    return `[${prefix}] ${String(data)}`;
  }
  const keys = Object.keys(data).sort();
  const summary = keys.map(k => `${k}=${data[k]}`).join('; ');
  return `[${prefix}] {${summary}}`;
}

function parseHelper17(formattedString) {
  if (typeof formattedString !== 'string') return {};
  const match = formattedString.match(/\[UTIL_17\] \{(.*)\}/);
  if (!match) return {};
  const result = {};
  match[1].split('; ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) result[k] = v;
  });
  return result;
}

module.exports = { formatHelper17, parseHelper17 };
