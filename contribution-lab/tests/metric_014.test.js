const test = require('node:test');
const assert = require('node:assert');
const { MetricCollector14 } = require('../utils/metric_014.js');

test('MetricCollector14 records events and calculates summary statistics', () => {
  const collector = new MetricCollector14('test_metric_14');
  collector.record('latency', 10);
  collector.record('latency', 30);
  const s = collector.summary();
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.total, 40);
  assert.strictEqual(s.avg, 20);
});
