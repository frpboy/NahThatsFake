const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector22 } = require('../utils/metric_022.js');

test('MetricCollector22 records events and calculates summary statistics', () => {
  const collector = new MetricCollector22('test_metric_22');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
