const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector36 } = require('../utils/metric_036.js');

test('MetricCollector36 records events and calculates summary statistics', () => {
  const collector = new MetricCollector36('test_metric_36');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
