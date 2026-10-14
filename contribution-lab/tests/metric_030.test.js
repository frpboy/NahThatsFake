const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector30 } = require('../utils/metric_030.js');

test('MetricCollector30 records events and calculates summary statistics', () => {
  const collector = new MetricCollector30('test_metric_30');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
