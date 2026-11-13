import assert from 'node:assert/strict';
import axios, { AxiosError, AxiosAdapter } from 'axios';
import http from 'node:http';
import https from 'node:https';
import { checkUrlSafety } from '../src/services/urlscanner';

// Actual provider adapters and Axios request construction, synthetic responses
// only. Any accidental real HTTP transport is a failing test, not live traffic.
const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;
const blocked = () => { throw new Error('Network transport forbidden in provider contract test'); };
http.request = blocked as typeof http.request;
https.request = blocked as typeof https.request;
const originalFetch = global.fetch;
global.fetch = blocked as typeof fetch;
const originalAdapter = axios.defaults.adapter;
const originalTimer = global.setTimeout;
const originalError = console.error;
const originalGoogleKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
const originalVtKey = process.env.VIRUSTOTAL_API_KEY;
process.env.GOOGLE_SAFE_BROWSING_KEY = 'synthetic-google-key';
process.env.VIRUSTOTAL_API_KEY = 'synthetic-vt-key';
global.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) =>
  originalTimer(fn, ms === 2000 ? 0 : ms, ...args)) as typeof setTimeout;

const clean = { malicious: 0, suspicious: 0, harmless: 10, undetected: 0 };
type Scenario = { lookupStatus?: number; status?: string; stats?: unknown; googleThreat?: boolean; lookupStats?: unknown };
let count = 0;
async function runCase(name: string, scenario: Scenario, expected: 'clean' | 'inconclusive' | 'threat', submits: number): Promise<void> {
  let posted = 0;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  const adapter: AxiosAdapter = async config => {
    const answer = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    if (config.url?.startsWith('https://safebrowsing.googleapis.com/')) {
      assert.equal(config.method, 'post');
      assert.equal(config.timeout, 5000);
      const body = JSON.parse(config.data);
      assert.equal(body.threatInfo.threatEntries[0].url, 'https://example.invalid/contract');
      return answer(scenario.googleThreat ? { matches: [{ threatType: 'MALWARE' }] } : {});
    }
    assert.equal(config.headers['x-apikey'], 'synthetic-vt-key');
    if (config.method === 'get' && config.url?.includes('/urls/')) {
      if (scenario.lookupStats !== undefined) return answer({ data: { attributes: { last_analysis_stats: scenario.lookupStats } } });
      const status = scenario.lookupStatus ?? 404;
      throw new AxiosError('synthetic-provider-error', 'ERR_BAD_RESPONSE', config, undefined,
        { data: { private: 'must-not-be-logged' }, status, statusText: 'error', headers: {}, config });
    }
    if (config.method === 'post' && config.url === 'https://www.virustotal.com/api/v3/urls') {
      posted++;
      assert.equal(config.data, 'url=https%3A%2F%2Fexample.invalid%2Fcontract');
      return answer({ data: { id: 'synthetic-analysis' } });
    }
    if (config.url === 'https://www.virustotal.com/api/v3/analyses/synthetic-analysis') {
      return answer({ data: { attributes: { status: scenario.status, stats: scenario.stats } } });
    }
    throw new Error('Unexpected provider route');
  };
  axios.defaults.adapter = adapter;
  if (expected === 'inconclusive') {
    await assert.rejects(checkUrlSafety('https://example.invalid/contract'), /inconclusive/, name);
  } else {
    const result = await checkUrlSafety('https://example.invalid/contract');
    assert.equal(result.scan_status, expected === 'clean' ? 'complete' : 'partial', name);
    assert.equal(result.risk_level, expected === 'clean' ? 'LOW' : 'HIGH', name);
  }
  assert.equal(posted, submits, name + ': unexpected submission');
  const log = JSON.stringify(logs);
  assert.ok(!log.includes('synthetic-google-key') && !log.includes('synthetic-vt-key') && !log.includes('must-not-be-logged'));
  console.log('PASS', name);
  count++;
}
async function run(): Promise<void> {
  await runCase('existing complete report', { lookupStats: clean }, 'clean', 0);
  await runCase('missing URL then completed analysis', { status: 'completed', stats: clean }, 'clean', 1);
  await runCase('queued empty analysis is inconclusive', { status: 'queued', stats: {} }, 'inconclusive', 1);
  await runCase('in-progress zero analysis is inconclusive', { status: 'in-progress', stats: { ...clean, harmless: 0 } }, 'inconclusive', 1);
  await runCase('in-progress nonzero analysis is still incomplete', { status: 'in-progress', stats: clean }, 'inconclusive', 1);
  await runCase('missing status fails closed', { stats: clean }, 'inconclusive', 1);
  await runCase('completed missing stats fails closed', { status: 'completed' }, 'inconclusive', 1);
  await runCase('completed empty stats fails closed', { status: 'completed', stats: {} }, 'inconclusive', 1);
  await runCase('completed zero verdicts fails closed', { status: 'completed', stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 } }, 'inconclusive', 1);
  await runCase('negative stats fails closed', { lookupStats: { ...clean, malicious: -1 } }, 'inconclusive', 0);
  await runCase('string stats fails closed', { lookupStats: { ...clean, harmless: '10' } }, 'inconclusive', 0);
  await runCase('Google threat survives incomplete VirusTotal', { googleThreat: true, status: 'queued', stats: {} }, 'threat', 1);
  for (const status of [401, 403, 429, 500]) {
    await runCase('lookup HTTP ' + status + ' does not submit', { lookupStatus: status }, 'inconclusive', 0);
  }
  console.log(count + ' provider-contract cases passed; real HTTP/fetch blocked');
}
void run().catch(error => { console.error = originalError; console.error(error); process.exitCode = 1; }).finally(() => {
  axios.defaults.adapter = originalAdapter;
  global.setTimeout = originalTimer;
  global.fetch = originalFetch;
  http.request = originalHttpRequest;
  https.request = originalHttpsRequest;
  console.error = originalError;
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_SAFE_BROWSING_KEY; else process.env.GOOGLE_SAFE_BROWSING_KEY = originalGoogleKey;
  if (originalVtKey === undefined) delete process.env.VIRUSTOTAL_API_KEY; else process.env.VIRUSTOTAL_API_KEY = originalVtKey;
});
