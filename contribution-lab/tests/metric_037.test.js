const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector37 } = require('../utils/metric_037.js');

test('MetricCollector37 records events and calculates summary statistics', () => {
  const collector = new MetricCollector37('test_metric_37');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
