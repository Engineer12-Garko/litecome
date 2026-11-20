import { detectProcessingCapabilities } from "./capability-detector.js";

export class WebCodecsEngine {
  async detect() {
    return detectProcessingCapabilities();
  }

  async compress() {
    throw new Error("WebCodecs encode and mux are not yet prototype-safe.");
  }
}
