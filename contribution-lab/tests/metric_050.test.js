const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector50 } = require('../utils/metric_050.js');

test('MetricCollector50 records events and calculates summary statistics', () => {
  const collector = new MetricCollector50('test_metric_50');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
