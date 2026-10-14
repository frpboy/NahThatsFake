const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector15 } = require('../utils/metric_015.js');

test('MetricCollector15 records events and calculates summary statistics', () => {
  const collector = new MetricCollector15('test_metric_15');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
