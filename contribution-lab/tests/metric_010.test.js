const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector10 } = require('../utils/metric_010.js');

test('MetricCollector10 records events and calculates summary statistics', () => {
  const collector = new MetricCollector10('test_metric_10');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
