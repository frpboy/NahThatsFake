import assert from 'node:assert/strict';
import {
  buildSeparateCheckResults,
  formatSeparateCheckResults,
  classifyServiceError
} from '../src/services/separateResults';

async function run(): Promise<void> {
  // Alex Meleshko's scenario: the image service times out but the link
  // check comes back clean. The two must be shown as separate results —
  // the image is inconclusive with NO verdict, the link keeps its own
  // clean result, and there is no combined safe/real verdict.
  const separate = buildSeparateCheckResults({
    image: { status: 'timeout' },
    link: { status: 'complete', score: 0, risk_level: 'LOW' }
  });

  assert.equal(separate.results.length, 2);

  const imageResult = separate.results.find(r => r.type === 'image');
  assert.ok(imageResult);
  assert.equal(imageResult.status, 'inconclusive');
  assert.equal(imageResult.risk_level, null);
  assert.equal(imageResult.score, null);
  assert.equal(imageResult.reason, 'timeout');

  const linkResult = separate.results.find(r => r.type === 'link');
  assert.ok(linkResult);
  assert.equal(linkResult.status, 'complete');
  assert.equal(linkResult.risk_level, 'LOW');
  assert.equal(linkResult.score, 0);

  assert.equal(separate.summary.complete, false);
  assert.deepEqual(separate.summary.inconclusiveTypes, ['image']);
  assert.match(separate.summary.headline, /Partial result/);
  assert.match(separate.summary.headline, /image check is inconclusive/);

  const message = formatSeparateCheckResults(separate);
  const imageSection = message.slice(message.indexOf('🖼️'), message.indexOf('🔗'));
  const linkSection = message.slice(message.indexOf('🔗'));
  assert.match(imageSection, /Inconclusive — the image service timed out/);
  assert.match(imageSection, /No verdict for the image/);
  // The clean/green link verdict must not leak into the image section.
  assert.doesNotMatch(imageSection, /🟢|LOW/);
  assert.match(linkSection, /Link check/);
  assert.match(linkSection, /LOW/);
  assert.match(linkSection, /about the link only/);
  // No single combined verdict anywhere in the message.
  assert.doesNotMatch(message, /Overall (result|verdict)/i);

  // Reverse direction: link times out, image is clean. The image keeps its
  // own verdict and the link is inconclusive — no merging either way.
  const reverse = buildSeparateCheckResults({
    image: { status: 'complete', score: 0.1, risk_level: 'LOW' },
    link: { status: 'timeout' }
  });
  assert.equal(reverse.summary.complete, false);
  assert.deepEqual(reverse.summary.inconclusiveTypes, ['link']);
  assert.equal(reverse.results.find(r => r.type === 'image')?.risk_level, 'LOW');
  assert.equal(reverse.results.find(r => r.type === 'link')?.risk_level, null);

  // Both complete: two separate complete results, summary is complete and
  // still presents no merged verdict.
  const both = buildSeparateCheckResults({
    image: { status: 'complete', score: 0.9, risk_level: 'HIGH' },
    link: { status: 'complete', score: 0, risk_level: 'LOW' }
  });
  assert.equal(both.summary.complete, true);
  assert.deepEqual(both.summary.inconclusiveTypes, []);
  assert.equal(both.results.find(r => r.type === 'image')?.risk_level, 'HIGH');
  assert.equal(both.results.find(r => r.type === 'link')?.risk_level, 'LOW');

  // Timeout classification: axios timeout errors and timeout messages are
  // 'timeout'; anything else is a generic 'error' (still inconclusive).
  assert.equal(classifyServiceError(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' })), 'timeout');
  assert.equal(classifyServiceError(new Error('Image analysis timed out')), 'timeout');
  assert.equal(classifyServiceError(new Error('Service temporarily unavailable')), 'error');

  console.log('Separate per-check results assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
