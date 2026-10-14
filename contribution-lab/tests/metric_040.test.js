const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector40 } = require('../utils/metric_040.js');

test('MetricCollector40 records events and calculates summary statistics', () => {
  const collector = new MetricCollector40('test_metric_40');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
