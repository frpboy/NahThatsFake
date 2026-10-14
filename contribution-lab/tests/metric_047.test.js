const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector47 } = require('../utils/metric_047.js');

test('MetricCollector47 records events and calculates summary statistics', () => {
  const collector = new MetricCollector47('test_metric_47');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
