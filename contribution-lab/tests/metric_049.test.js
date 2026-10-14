const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector49 } = require('../utils/metric_049.js');

test('MetricCollector49 records events and calculates summary statistics', () => {
  const collector = new MetricCollector49('test_metric_49');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
