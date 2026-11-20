export async function detectProcessingCapabilities() {
  const capabilities = {
    webCodecs: Boolean(globalThis.VideoEncoder && globalThis.VideoDecoder && globalThis.VideoFrame),
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
    offscreenVideoFrame: typeof OffscreenCanvas !== "undefined",
    opfs: Boolean(navigator.storage?.getDirectory),
    worker: typeof Worker !== "undefined",
    hardwareH264: false
  };

  if (globalThis.VideoEncoder?.isConfigSupported) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec: "avc1.42001f",
        width: 1280,
        height: 720,
        framerate: 30,
        bitrate: 2_500_000,
        hardwareAcceleration: "prefer-hardware"
      });
      capabilities.hardwareH264 = Boolean(result.supported);
    } catch {}
  }

  return capabilities;
}
