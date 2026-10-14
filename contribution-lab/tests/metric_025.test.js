const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector25 } = require('../utils/metric_025.js');

test('MetricCollector25 records events and calculates summary statistics', () => {
  const collector = new MetricCollector25('test_metric_25');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
