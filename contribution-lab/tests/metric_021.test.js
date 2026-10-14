const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector21 } = require('../utils/metric_021.js');

test('MetricCollector21 records events and calculates summary statistics', () => {
  const collector = new MetricCollector21('test_metric_21');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
