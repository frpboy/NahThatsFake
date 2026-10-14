const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector35 } = require('../utils/metric_035.js');

test('MetricCollector35 records events and calculates summary statistics', () => {
  const collector = new MetricCollector35('test_metric_35');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
