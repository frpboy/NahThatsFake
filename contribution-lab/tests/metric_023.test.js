const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector23 } = require('../utils/metric_023.js');

test('MetricCollector23 records events and calculates summary statistics', () => {
  const collector = new MetricCollector23('test_metric_23');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
