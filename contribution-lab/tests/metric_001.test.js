const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector1 } = require('../utils/metric_001.js');

test('MetricCollector1 records events and calculates summary statistics', () => {
  const collector = new MetricCollector1('test_metric_1');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
