const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector12 } = require('../utils/metric_012.js');

test('MetricCollector12 records events and calculates summary statistics', () => {
  const collector = new MetricCollector12('test_metric_12');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
