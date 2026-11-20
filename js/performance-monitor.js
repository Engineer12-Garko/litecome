export class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
  }

  start(name) {
    this.marks.set(name, performance.now());
  }

  end(name) {
    const start = this.marks.get(name);
    if (start === undefined) return null;
    const duration = performance.now() - start;
    this.marks.delete(name);
    return duration;
  }

  snapshot() {
    return {
      now: performance.now(),
      memory: performance.memory?.usedJSHeapSize || null,
      totalMemory: performance.memory?.totalJSHeapSize || null,
      activeMarks: Object.fromEntries(this.marks)
    };
  }
}
