'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildSeparateResults,
  outcomeFromCheckRow,
  describeCheckResult
} = require('../public/js/check-results.js');

test('image timeout + link clean gives two separate results, image inconclusive', () => {
  const separate = buildSeparateResults({
    image: { status: 'timeout' },
    link: { status: 'complete', score: 0, risk_level: 'LOW' }
  });

  assert.equal(separate.results.length, 2);

  const image = separate.results.find(r => r.type === 'image');
  assert.equal(image.status, 'inconclusive');
  assert.equal(image.risk_level, null);
  assert.equal(image.score, null);
  assert.equal(image.reason, 'timeout');

  const link = separate.results.find(r => r.type === 'link');
  assert.equal(link.status, 'complete');
  assert.equal(link.risk_level, 'LOW');

  // No combined clean verdict: the summary must flag the inconclusive part.
  assert.equal(separate.summary.complete, false);
  assert.deepEqual(separate.summary.inconclusiveTypes, ['image']);
  assert.match(separate.summary.headline, /Partial result/);
  assert.match(separate.summary.headline, /no verdict for it/);
});

test('a stored check row without a score is inconclusive, not 0% risk', () => {
  assert.deepEqual(outcomeFromCheckRow({ risk_level: null, score: null }), { status: 'inconclusive' });
  assert.deepEqual(outcomeFromCheckRow({ risk_level: 'UNKNOWN', score: null }), { status: 'inconclusive' });
  assert.deepEqual(
    outcomeFromCheckRow({ risk_level: 'LOW', score: 0 }),
    { status: 'complete', risk_level: 'LOW', score: 0 }
  );
});

test('detail text keeps each verdict scoped to its own check', () => {
  const linkText = describeCheckResult({ check_type: 'link', risk_level: 'LOW', score: 0 });
  assert.match(linkText, /Link check: LOW risk \(0%\)/);
  assert.match(linkText, /applies only to this link/);

  const imageText = describeCheckResult({ check_type: 'image', risk_level: null, score: null });
  assert.match(imageText, /Image check: inconclusive/);
  assert.match(imageText, /not a clean or safe result/);
});

test('Mini App loads check-results.js before app.js and renders inconclusive neutrally', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const resultsIdx = indexHtml.indexOf('js/check-results.js');
  const appIdx = indexHtml.indexOf('js/app.js');
  assert.ok(resultsIdx !== -1 && appIdx !== -1 && resultsIdx < appIdx);

  const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(appJs, /SeparateCheckResults\.outcomeFromCheckRow/);
  assert.match(appJs, /SeparateCheckResults\.describeCheckResult/);
  assert.match(appJs, /'No verdict'/);

  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  assert.match(css, /\.risk-inconclusive/);
});
