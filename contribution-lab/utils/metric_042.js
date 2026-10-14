/**
 * Metric Collector & Aggregator 42
 */

class MetricCollector42 {
  constructor(namespace = 'metric_42') {
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

module.exports = { MetricCollector42 };
