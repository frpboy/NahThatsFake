import assert from 'node:assert/strict';
import { checkUrlSafety, getScanCoverage } from '../src/services/urlscanner';

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

  console.log('URL scanner provider coverage and failure-state assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
