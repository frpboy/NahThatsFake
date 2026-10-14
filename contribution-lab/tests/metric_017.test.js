const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector17 } = require('../utils/metric_017.js');

test('MetricCollector17 records events and calculates summary statistics', () => {
  const collector = new MetricCollector17('test_metric_17');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
