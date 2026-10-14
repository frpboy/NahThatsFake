const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector34 } = require('../utils/metric_034.js');

test('MetricCollector34 records events and calculates summary statistics', () => {
  const collector = new MetricCollector34('test_metric_34');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
