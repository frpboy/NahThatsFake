const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector27 } = require('../utils/metric_027.js');

test('MetricCollector27 records events and calculates summary statistics', () => {
  const collector = new MetricCollector27('test_metric_27');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
