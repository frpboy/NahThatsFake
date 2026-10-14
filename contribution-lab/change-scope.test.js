'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyChange, summarizeChanges } = require('./change-scope');

test('classifies repository areas without inspecting file contents', () => {
  assert.equal(classifyChange('bot/src/index.ts'), 'bot');
  assert.equal(classifyChange('tma/public/js/app.js'), 'mini-app');
  assert.equal(classifyChange('supabase/migrations/example.sql'), 'database');
  assert.equal(classifyChange('contribution-lab/README.md'), 'experiment');
  assert.equal(classifyChange('README.md'), 'repository');
});

test('summarizes a changed-file list by scope', () => {
  assert.deepEqual(
    summarizeChanges([
      'bot/src/index.ts',
      'tma/server.js',
      'tma/public/index.html',
      'README.md'
    ]),
    { bot: 1, 'mini-app': 2, repository: 1 }
  );
});
