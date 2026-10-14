const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector44 } = require('../utils/metric_044.js');

test('MetricCollector44 records events and calculates summary statistics', () => {
  const collector = new MetricCollector44('test_metric_44');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
