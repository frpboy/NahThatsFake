const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector42 } = require('../utils/metric_042.js');

test('MetricCollector42 records events and calculates summary statistics', () => {
  const collector = new MetricCollector42('test_metric_42');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
