const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector20 } = require('../utils/metric_020.js');

test('MetricCollector20 records events and calculates summary statistics', () => {
  const collector = new MetricCollector20('test_metric_20');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
