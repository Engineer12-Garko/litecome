# LiteCompress 3.0 Baseline Benchmark

## Environment

- Browser: Chromium 150 (Electron/Code/VS Code embedded browser)
- Platform: Windows
- Page: local static server
- Engine: existing FFmpeg.wasm single-thread core
- SharedArrayBuffer: unavailable
- Cross-origin isolated: false
- WebCodecs: available
- VideoEncoder H.264 hardware-preference probe: supported
- OPFS: available
- Web Worker: available

## Browser measurement

- Page load duration: 305 ms
- DOM interactive: 193.8 ms
- DOM complete/load: approximately 304-305 ms
- HTML response: 80.4 ms

## Generated 640x360 baseline encode

- Input: 867 B generated WebM
- Requested duration: approximately 4 seconds
- Browser metadata duration: unavailable for this generated fixture
- Resolution metadata: unavailable for this fixture
- Balanced preset
- Encoding and UI completion wall time: 1,965 ms
- Output: 1.7 KB MP4
- Output comparison: 105% larger than tiny synthetic source
- Download: available
- Audio: synthetic WebM fixture had no meaningful audio track

This synthetic fixture is too small to establish video-encoding throughput or quality. It should be used only as a smoke benchmark.

## Single-thread bottleneck conclusion

The measured local fixture was dominated by FFmpeg initialization/worker startup and small-file overhead; no encoding FPS or real-time factor can be derived because duration metadata was unavailable.

The source code indicates the likely dominant bottleneck for representative videos is WASM x264 execution rather than UI rendering:

- FFmpeg is intentionally lazy-loaded once per worker.
- Input is copied to the FFmpeg virtual filesystem.
- Output is read back as a Uint8Array.
- Segmented jobs write one MP4 to OPFS and re-read all segment files during final assembly.
- Segment assembly can duplicate large buffers in the WASM virtual filesystem and browser memory.
- FFmpeg progress callbacks update UI state; this is much lower cost than encoding.

## Measured capability result

WebCodecs primitives are available in Chromium. `VideoEncoder.isConfigSupported()` reports H.264 AVC `avc1.42001f` with hardware preference is supported for 1280x720. This is evidence of API support, not evidence of reliable hardware encoding or demux/mux support.

## Not yet measured

- 720p/1080p/4K representative baseline
- x264 preset speed
- SSIM/VMAF
- Peak memory
- CPU utilization
- Initialization versus encoding phase timing
- Input virtual-filesystem transfer time
- Segment assembly memory
- Offline cold start
