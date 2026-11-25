import assert from 'node:assert/strict';
import {
  checkUrlSafety,
  checkVirusTotal,
  getScanCoverage,
  validateVirusTotalStats,
  type VirusTotalHttp
} from '../src/services/urlscanner';

process.env.VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || 'test-key';

/** Deterministic clock for polling tests: sleep() and advance() move time. */
function makePollClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    advance: (ms: number) => { t += ms; },
    elapsed: () => t
  };
}

function fastPoll() {
  const clock = makePollClock();
  return { options: { intervalMs: 1, maxWaitMs: 100, sleep: clock.sleep, now: clock.now }, clock };
}

function notFoundError(): Error & { response: { status: number } } {
  const err = new Error('not found') as Error & { response: { status: number } };
  err.response = { status: 404 };
  return err;
}

/**
 * Stub VT HTTP: no existing report; analysis status follows `statuses`.
 * Records every analysis GET so tests can assert the submitted analysis
 * ID is the one being polled (Sourcery test-gap finding on PR #462).
 */
function stubSubmitFlow(statuses: string[], stats: unknown, onPoll?: () => void) {
  const analysisGets: string[] = [];
  const http: VirusTotalHttp = {
    get: async (url: string) => {
      if (url.includes('/urls/')) throw notFoundError();
      analysisGets.push(url);
      if (onPoll) onPoll();
      const status = statuses[Math.min(analysisGets.length - 1, statuses.length - 1)];
      return { data: { data: { attributes: { status, stats } } } };
    },
    post: async () => ({ data: { data: { id: 'analysis-1' } } })
  };
  return { http, analysisGets };
}

const cleanGoogle = async () => ({ threats: [], safe: true });
const cleanVirusTotal = async () => ({ malicious: 0, suspicious: 0, harmless: 10, undetected: 0 });
const unavailable = async (): Promise<never> => {
  throw new Error('synthetic provider failure');
};

async function run(): Promise<void> {
  assert.equal(getScanCoverage(0, 0), 'unavailable');
  assert.equal(getScanCoverage(1, 0), 'inconclusive');
  assert.equal(getScanCoverage(1, 1), 'partial');
  assert.equal(getScanCoverage(2, 0), 'complete');

  await assert.rejects(
    checkUrlSafety('https://example.invalid', { google: unavailable, virusTotal: unavailable }),
    /inconclusive/
  );
  await assert.rejects(
    checkUrlSafety('https://example.invalid', { google: cleanGoogle, virusTotal: unavailable }),
    /inconclusive/
  );

  const partialThreat = await checkUrlSafety('https://example.invalid', {
    google: unavailable,
    virusTotal: async () => ({ malicious: 1, suspicious: 0, harmless: 0, undetected: 0 })
  });
  assert.equal(partialThreat.scan_status, 'partial');
  assert.equal(partialThreat.risk_level, 'MEDIUM');
  assert.ok(partialThreat.threats.length > 0);
  assert.ok(partialThreat.sources.includes('VirusTotal'));

  const completeClean = await checkUrlSafety('https://example.invalid', {
    google: cleanGoogle,
    virusTotal: cleanVirusTotal
  });
  assert.equal(completeClean.scan_status, 'complete');
  assert.equal(completeClean.risk_level, 'LOW');

  // --- VirusTotal completion discipline (plan item 1.1) ---

  // Stats validation: malformed or empty stats are never evidence.
  assert.throws(() => validateVirusTotalStats(undefined), /missing analysis stats/);
  assert.throws(() => validateVirusTotalStats({ malicious: 0, suspicious: 0, harmless: 5 }), /"undetected"/);
  assert.throws(
    () => validateVirusTotalStats({ malicious: 0, suspicious: 0, harmless: 0, undetected: 0 }),
    /no engine results/
  );
  // Fractional engine counts are invalid data, not a verdict input.
  assert.throws(
    () => validateVirusTotalStats({ malicious: 0.5, suspicious: 0, harmless: 60, undetected: 20 }),
    /"malicious"/
  );
  assert.deepEqual(
    validateVirusTotalStats({ malicious: 2, suspicious: 1, harmless: 60, undetected: 20 }),
    { malicious: 2, suspicious: 1, harmless: 60, undetected: 20 }
  );

  // Analysis stuck at queued/in-progress: provider failure, never a verdict.
  const stuck = stubSubmitFlow(['queued', 'in-progress'], { malicious: 0, suspicious: 0, harmless: 90, undetected: 0 });
  const stuckPoll = fastPoll();
  await assert.rejects(checkVirusTotal('https://example.invalid', stuck.http, stuckPoll.options), /did not complete/);
  await assert.rejects(
    checkUrlSafety('https://example.invalid', {
      google: cleanGoogle,
      virusTotal: (u) => checkVirusTotal(u, stuck.http, fastPoll().options)
    }),
    /inconclusive/
  );
  // The poll must target the exact analysis ID returned by submission.
  assert.ok(stuck.analysisGets.length > 0);
  assert.ok(stuck.analysisGets.every((u) => u.endsWith('/analyses/analysis-1')));

  // Analysis completing on the 3rd poll: stats are used, suspicious included.
  const completing = stubSubmitFlow(
    ['queued', 'in-progress', 'completed'],
    { malicious: 3, suspicious: 2, harmless: 70, undetected: 17 }
  );
  const completedStats = await checkVirusTotal('https://example.invalid', completing.http, fastPoll().options);
  assert.equal(completedStats.malicious, 3);
  assert.equal(completedStats.suspicious, 2);
  assert.equal(completedStats.harmless, 70);
  assert.equal(completing.analysisGets.length, 3);
  assert.ok(completing.analysisGets.every((u) => u.endsWith('/analyses/analysis-1')));

  // Completed analysis with malformed stats: provider failure, not 0 malicious.
  const malformed = stubSubmitFlow(['completed'], { malicious: 0, harmless: 10 });
  await assert.rejects(checkVirusTotal('https://example.invalid', malformed.http, fastPoll().options), /VirusTotal/);

  // Slow pending responses: request time counts against the budget, so the
  // absolute deadline stops polling instead of stretching past it
  // (CodeRabbit + Sourcery headline finding on PR #462). Each GET consumes
  // 9 s of the 20 s budget: exactly 2 polls happen, not 11.
  const slowClock = makePollClock();
  const slow = stubSubmitFlow(['queued'], { malicious: 0, suspicious: 0, harmless: 90, undetected: 0 }, () => slowClock.advance(9000));
  await assert.rejects(
    checkVirusTotal('https://example.invalid', slow.http, {
      intervalMs: 2000, maxWaitMs: 20000, sleep: slowClock.sleep, now: slowClock.now
    }),
    /did not complete/
  );
  assert.equal(slow.analysisGets.length, 2);
  assert.ok(slowClock.elapsed() <= 20000 + 9000, 'polling stopped at the deadline, not after ~119 s of sleeps');

  // A completed response that only arrives after the deadline is rejected.
  const lateClock = makePollClock();
  const late = stubSubmitFlow(['completed'], { malicious: 0, suspicious: 0, harmless: 90, undetected: 0 }, () => lateClock.advance(25000));
  await assert.rejects(
    checkVirusTotal('https://example.invalid', late.http, {
      intervalMs: 2000, maxWaitMs: 20000, sleep: lateClock.sleep, now: lateClock.now
    }),
    /did not complete/
  );

  // Existing report path: populated stats are used; an all-zero report is not evidence.
  const reportHttp: VirusTotalHttp = {
    get: async () => ({
      data: { data: { attributes: { last_analysis_stats: { malicious: 1, suspicious: 4, harmless: 80, undetected: 9 } } } }
    }),
    post: async () => { throw new Error('submit must not be called when a report exists'); }
  };
  const reportStats = await checkVirusTotal('https://example.invalid', reportHttp, fastPoll().options);
  assert.equal(reportStats.malicious, 1);
  assert.equal(reportStats.suspicious, 4);

  const emptyReportHttp: VirusTotalHttp = {
    get: async () => ({
      data: { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 } } } }
    }),
    post: async () => { throw new Error('submit must not be called when a report exists'); }
  };
  await assert.rejects(checkVirusTotal('https://example.invalid', emptyReportHttp, fastPoll().options), /no engine results/);

  console.log('URL scanner provider coverage and failure-state assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
