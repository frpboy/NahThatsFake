'use strict';

function classifyChange(path) {
  if (path.startsWith('bot/')) return 'bot';
  if (path.startsWith('tma/')) return 'mini-app';
  if (path.startsWith('supabase/')) return 'database';
  if (path.startsWith('contribution-lab/')) return 'experiment';
  return 'repository';
}

function summarizeChanges(paths) {
  return paths.reduce((summary, path) => {
    const scope = classifyChange(path);
    summary[scope] = (summary[scope] || 0) + 1;
    return summary;
  }, {});
}

module.exports = { classifyChange, summarizeChanges };
