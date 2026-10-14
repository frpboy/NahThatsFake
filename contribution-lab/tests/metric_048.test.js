const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector48 } = require('../utils/metric_048.js');

test('MetricCollector48 records events and calculates summary statistics', () => {
  const collector = new MetricCollector48('test_metric_48');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
