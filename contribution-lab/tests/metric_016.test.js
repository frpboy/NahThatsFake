const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector16 } = require('../utils/metric_016.js');

test('MetricCollector16 records events and calculates summary statistics', () => {
  const collector = new MetricCollector16('test_metric_16');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
