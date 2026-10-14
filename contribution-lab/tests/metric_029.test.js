const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector29 } = require('../utils/metric_029.js');

test('MetricCollector29 records events and calculates summary statistics', () => {
  const collector = new MetricCollector29('test_metric_29');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
