const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector7 } = require('../utils/metric_007.js');

test('MetricCollector7 records events and calculates summary statistics', () => {
  const collector = new MetricCollector7('test_metric_7');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
