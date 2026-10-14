/**
 * Metric Collector & Aggregator 1
 */

class MetricCollector1 {
  constructor(namespace = 'metric_1') {
    this.namespace = namespace;
    this.events = [];
  }

  record(key, val, tags = {}) {
    this.events.push({
      key,
      val: Number(val) || 0,
      tags,
      timestamp: Date.now()
    });
  }

  summary() {
    const total = this.events.reduce((acc, e) => acc + e.val, 0);
    return {
      namespace: this.namespace,
      count: this.events.length,
      total,
      avg: this.events.length ? total / this.events.length : 0
    };
  }
}

module.exports = { MetricCollector1 };
