const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector38 } = require('../utils/metric_038.js');

test('MetricCollector38 records events and calculates summary statistics', () => {
  const collector = new MetricCollector38('test_metric_38');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
