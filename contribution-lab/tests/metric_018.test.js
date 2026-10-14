const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector18 } = require('../utils/metric_018.js');

test('MetricCollector18 records events and calculates summary statistics', () => {
  const collector = new MetricCollector18('test_metric_18');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
