const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector11 } = require('../utils/metric_011.js');

test('MetricCollector11 records events and calculates summary statistics', () => {
  const collector = new MetricCollector11('test_metric_11');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
