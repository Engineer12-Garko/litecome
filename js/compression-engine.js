export class CompressionEngine {
  constructor() {
    this.worker = null;
  }

  ensureWorker(onProgress) {
    if (this.worker) return this.worker;
    this.worker = new Worker("./js/compression-worker.js", { type: "module" });
    this.worker.onmessage = (event) => onProgress(event.data);
    return this.worker;
  }

  compress(file, preset, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker(onProgress);
      const handleMessage = (event) => {
        if (event.data.id !== file.__jobId) return;
        if (event.data.type === "complete") {
          worker.removeEventListener("message", handleMessage);
          resolve(event.data);
        } else if (event.data.type === "error") {
          worker.removeEventListener("message", handleMessage);
          reject(new Error(event.data.message));
        }
      };
      worker.addEventListener("message", handleMessage);
      worker.postMessage({
        id: file.__jobId,
        type: "compress",
        file,
        preset
      });
    });
  }

  terminate() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
}
