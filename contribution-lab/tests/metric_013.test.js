const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector13 } = require('../utils/metric_013.js');

test('MetricCollector13 records events and calculates summary statistics', () => {
  const collector = new MetricCollector13('test_metric_13');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
