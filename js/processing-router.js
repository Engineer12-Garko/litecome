import { detectProcessingCapabilities } from "./capability-detector.js";
import { WebCodecsEngine } from "./webcodecs-engine.js";

export class ProcessingRouter {
  constructor(ffmpegEngine) {
    this.ffmpeg = ffmpegEngine;
    this.webcodecs = new WebCodecsEngine();
  }

  async detect() {
    this.capabilities = await detectProcessingCapabilities();
    return this.capabilities;
  }

  async select() {
    await this.detect();

    // WebCodecs is currently capability-detected only. Production quality
    // requires demuxing, audio preservation, timestamp handling and muxing,
    // none of which are safely available in this build.
    return {
      name: "FFmpeg.wasm",
      mode: this.capabilities.crossOriginIsolated && this.capabilities.sharedArrayBuffer
        ? "multithread-capable"
        : "single-thread",
      reason: "Validated FFmpeg encode and mux fallback"
    };
  }

  compress(file, preset, onProgress) {
    return this.ffmpeg.compress(file, preset, onProgress);
  }

  compressSegment(file, preset, segment, onProgress) {
    return this.ffmpeg.compressSegment(file, preset, segment, onProgress);
  }

  assemble(jobId, segmentCount, onProgress) {
    return this.ffmpeg.assemble(jobId, segmentCount, onProgress);
  }

  cancel(id) {
    this.ffmpeg.cancel(id);
  }

  cancelAll() {
    this.ffmpeg.cancelAll();
  }

  terminate() {
    this.ffmpeg.terminate();
  }
}
