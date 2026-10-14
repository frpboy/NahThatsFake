const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector46 } = require('../utils/metric_046.js');

test('MetricCollector46 records events and calculates summary statistics', () => {
  const collector = new MetricCollector46('test_metric_46');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
