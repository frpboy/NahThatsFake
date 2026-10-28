import assert from 'node:assert/strict';
import { getScanCoverage } from '../src/services/urlscanner';

assert.equal(getScanCoverage(0, 0), 'unavailable', 'no provider response is unavailable');
assert.equal(getScanCoverage(1, 0), 'inconclusive', 'one clean response cannot establish a clean result');
assert.equal(getScanCoverage(1, 1), 'partial', 'a detected threat is retained when one provider responds');
assert.equal(getScanCoverage(2, 0), 'complete', 'both clean provider responses complete coverage');
assert.equal(getScanCoverage(2, 1), 'complete', 'both provider responses complete coverage when a threat is detected');

console.log('URL scanner provider-coverage assertions passed');
