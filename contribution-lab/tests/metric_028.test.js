const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector28 } = require('../utils/metric_028.js');

test('MetricCollector28 records events and calculates summary statistics', () => {
  const collector = new MetricCollector28('test_metric_28');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
