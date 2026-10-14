const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector43 } = require('../utils/metric_043.js');

test('MetricCollector43 records events and calculates summary statistics', () => {
  const collector = new MetricCollector43('test_metric_43');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
