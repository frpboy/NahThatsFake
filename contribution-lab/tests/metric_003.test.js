const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector3 } = require('../utils/metric_003.js');

test('MetricCollector3 records events and calculates summary statistics', () => {
  const collector = new MetricCollector3('test_metric_3');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
