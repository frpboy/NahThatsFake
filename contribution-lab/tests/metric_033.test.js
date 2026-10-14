const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector33 } = require('../utils/metric_033.js');

test('MetricCollector33 records events and calculates summary statistics', () => {
  const collector = new MetricCollector33('test_metric_33');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
