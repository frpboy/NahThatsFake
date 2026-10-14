const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector2 } = require('../utils/metric_002.js');

test('MetricCollector2 records events and calculates summary statistics', () => {
  const collector = new MetricCollector2('test_metric_2');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
