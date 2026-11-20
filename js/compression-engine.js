export class CompressionEngine {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.onWorkerError = null;
  }

  ensureWorker(onProgress) {
    if (this.worker) return this.worker;
    this.worker = new Worker("./js/compression-worker.js", { type: "module" });
    this.worker.onmessage = (event) => {
      onProgress(event.data);
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      if (event.data.type === "complete") {
        this.pending.delete(event.data.id);
        pending.resolve(event.data);
      } else if (event.data.type === "error") {
        this.pending.delete(event.data.id);
        pending.reject(new Error(event.data.message));
      }
    };
    this.worker.onerror = (event) => {
      const message = event.message || "The compression worker stopped unexpectedly.";
      for (const pending of this.pending.values()) pending.reject(new Error(message));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    };
    return this.worker;
  }

  compress(file, preset, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker(onProgress);
      this.pending.set(file.__jobId, { resolve, reject });
      worker.postMessage({
        id: file.__jobId,
        type: "compress",
        file,
        preset
      });
    });
  }

  cancel(id) {
    const pending = this.pending.get(id);
    if (pending) {
      this.pending.delete(id);
      pending.reject(new DOMException("Compression cancelled.", "AbortError"));
    }
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }

  cancelAll() {
    for (const pending of this.pending.values()) {
      pending.reject(new DOMException("Compression cancelled.", "AbortError"));
    }
    this.pending.clear();
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }

  terminate() {
    this.cancelAll();
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
}
