const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector19 } = require('../utils/metric_019.js');

test('MetricCollector19 records events and calculates summary statistics', () => {
  const collector = new MetricCollector19('test_metric_19');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
