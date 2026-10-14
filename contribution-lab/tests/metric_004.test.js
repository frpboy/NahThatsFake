const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector4 } = require('../utils/metric_004.js');

test('MetricCollector4 records events and calculates summary statistics', () => {
  const collector = new MetricCollector4('test_metric_4');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
