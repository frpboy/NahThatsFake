const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector45 } = require('../utils/metric_045.js');

test('MetricCollector45 records events and calculates summary statistics', () => {
  const collector = new MetricCollector45('test_metric_45');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
