const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector6 } = require('../utils/metric_006.js');

test('MetricCollector6 records events and calculates summary statistics', () => {
  const collector = new MetricCollector6('test_metric_6');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
