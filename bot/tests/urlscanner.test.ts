import assert from 'node:assert/strict';
import {
  checkUrlSafety,
  checkVirusTotal,
  getScanCoverage,
  validateVirusTotalStats,
  type VirusTotalHttp
} from '../src/services/urlscanner';

process.env.VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || 'test-key';

const noSleep = async () => {};
const fastPoll = { intervalMs: 1, maxWaitMs: 3, sleep: noSleep };

function notFoundError(): Error & { response: { status: number } } {
  const err = new Error('not found') as Error & { response: { status: number } };
  err.response = { status: 404 };
  return err;
}

/** Stub VT HTTP: no existing report; analysis status follows `statuses`. */
function stubSubmitFlow(statuses: string[], stats: unknown): VirusTotalHttp {
  let polls = 0;
  return {
    get: async (url: string) => {
      if (url.includes('/urls/')) throw notFoundError();
      const status = statuses[Math.min(polls, statuses.length - 1)];
      polls++;
      return { data: { data: { attributes: { status, stats } } } };
    },
    post: async () => ({ data: { data: { id: 'analysis-1' } } })
  };
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
  assert.deepEqual(
    validateVirusTotalStats({ malicious: 2, suspicious: 1, harmless: 60, undetected: 20 }),
    { malicious: 2, suspicious: 1, harmless: 60, undetected: 20 }
  );

  // Analysis stuck at queued/in-progress: provider failure, never a verdict.
  const stuckHttp = stubSubmitFlow(['queued', 'in-progress'], { malicious: 0, suspicious: 0, harmless: 90, undetected: 0 });
  await assert.rejects(checkVirusTotal('https://example.invalid', stuckHttp, fastPoll), /did not complete/);
  await assert.rejects(
    checkUrlSafety('https://example.invalid', {
      google: cleanGoogle,
      virusTotal: (u) => checkVirusTotal(u, stuckHttp, fastPoll)
    }),
    /inconclusive/
  );

  // Analysis completing on the 3rd poll: stats are used.
  const completingHttp = stubSubmitFlow(
    ['queued', 'in-progress', 'completed'],
    { malicious: 3, suspicious: 0, harmless: 70, undetected: 17 }
  );
  const completedStats = await checkVirusTotal('https://example.invalid', completingHttp, fastPoll);
  assert.equal(completedStats.malicious, 3);
  assert.equal(completedStats.harmless, 70);

  // Completed analysis with malformed stats: provider failure, not 0 malicious.
  const malformedHttp = stubSubmitFlow(['completed'], { malicious: 0, harmless: 10 });
  await assert.rejects(checkVirusTotal('https://example.invalid', malformedHttp, fastPoll), /VirusTotal/);

  // Existing report path: populated stats are used; an all-zero report is not evidence.
  const reportHttp: VirusTotalHttp = {
    get: async () => ({
      data: { data: { attributes: { last_analysis_stats: { malicious: 1, suspicious: 0, harmless: 80, undetected: 9 } } } }
    }),
    post: async () => { throw new Error('submit must not be called when a report exists'); }
  };
  const reportStats = await checkVirusTotal('https://example.invalid', reportHttp, fastPoll);
  assert.equal(reportStats.malicious, 1);

  const emptyReportHttp: VirusTotalHttp = {
    get: async () => ({
      data: { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 } } } }
    }),
    post: async () => { throw new Error('submit must not be called when a report exists'); }
  };
  await assert.rejects(checkVirusTotal('https://example.invalid', emptyReportHttp, fastPoll), /no engine results/);

  console.log('URL scanner provider coverage and failure-state assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
