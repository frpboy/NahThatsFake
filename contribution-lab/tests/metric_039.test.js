const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector39 } = require('../utils/metric_039.js');

test('MetricCollector39 records events and calculates summary statistics', () => {
  const collector = new MetricCollector39('test_metric_39');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
