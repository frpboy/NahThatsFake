const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector24 } = require('../utils/metric_024.js');

test('MetricCollector24 records events and calculates summary statistics', () => {
  const collector = new MetricCollector24('test_metric_24');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
