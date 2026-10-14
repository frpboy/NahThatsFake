const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector9 } = require('../utils/metric_009.js');

test('MetricCollector9 records events and calculates summary statistics', () => {
  const collector = new MetricCollector9('test_metric_9');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
