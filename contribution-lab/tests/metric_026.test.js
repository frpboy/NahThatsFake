const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector26 } = require('../utils/metric_026.js');

test('MetricCollector26 records events and calculates summary statistics', () => {
  const collector = new MetricCollector26('test_metric_26');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
