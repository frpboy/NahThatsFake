const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector32 } = require('../utils/metric_032.js');

test('MetricCollector32 records events and calculates summary statistics', () => {
  const collector = new MetricCollector32('test_metric_32');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
