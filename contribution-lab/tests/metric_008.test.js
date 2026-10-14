const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector8 } = require('../utils/metric_008.js');

test('MetricCollector8 records events and calculates summary statistics', () => {
  const collector = new MetricCollector8('test_metric_8');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
