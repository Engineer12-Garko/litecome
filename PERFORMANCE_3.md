# LiteCompress 3.0 Performance Engineering Report

## Branch

Experimental implementation is isolated on `experimental/extreme-performance`. It has not been merged into `main`.

## Baseline root cause

No representative 720p/1080p/4K fixture was available, so a source-level root-cause ranking is used:

1. Single-thread x264 execution is the dominant likely bottleneck for video-heavy jobs.
2. WASM startup/core transfer is the dominant cost for very short first jobs.
3. Input copying to the FFmpeg virtual filesystem duplicates file data.
4. Segment resume adds OPFS writes and later revalidation/assembly reads.
5. Final assembly loads segment files back into the FFmpeg virtual filesystem and browser memory.
6. UI progress and Blob object-URL work are low cost relative to encode/decode.

## Measured baseline

- Chromium 150 in VS Code/Electron
- Page load 305 ms
- DOM interactive 193.8 ms
- FFmpeg single-thread engine
- SharedArrayBuffer unavailable
- Cross-origin isolated false
- Generated 640x360 smoke WebM: 867 B, no usable duration metadata
- Smoke encode wall time: 1.965 s
- Output: 1.7 KB MP4

This baseline was not a fair throughput benchmark because the fixture duration and output quality target were unknown. It is recorded as a smoke test only.

## Experimental smoke measurement

- Chromium 150
- Generated 640x360 3-second WebM
- Existing Balanced preset
- 19.4 KB input
- FFmpeg single-thread fallback
- 5.067 s until UI completion
- Output: 10.3 KB MP4
- Download and browser playback metadata validation succeeded

This measurement is not compared to the baseline 1.965-s result because the fixture, duration, resolution metadata, and input size differ. No speedup is claimed.

## WebCodecs findings

The experiment verifies:

- `VideoEncoder`, `VideoDecoder`, and `VideoFrame` are available in the Chromium test browser.
- An H.264 1280x720 hardware-preference configuration reports supported.
- `SharedArrayBuffer` and cross-origin isolation are unavailable in the current embedded Chromium context.

The WebCodecs prototype remains intentionally blocked from production because:

- Container demux/mux is not bundled.
- AudioDecoder/AudioEncoder preservation is not validated.
- Rotation metadata, variable frame rate, keyframes, timestamp preservation, and final mux integrity are not validated.
- There is no proven recoverable segment checkpoint format.

The app therefore reports FFmpeg as the selected engine and performs no silent WebCodecs quality/format switch.

## FFmpeg multithread core

The experimental assets are vendored but not enabled unless:

- `SharedArrayBuffer` exists
- `crossOriginIsolated` is true

The current browser remains on single-thread FFmpeg. No multithread benchmark is claimed.

COOP/COEP headers were not added because the tested browser was not cross-origin isolated and existing headers were not production-verified. Render asset MIME types and cross-origin isolation must be tested before enabling the multithread core in a deployment.

## Encoding optimization staged

- Small/Fast mode now uses x264 `veryfast`; resolution and frame rate are unchanged.
- Quality remains `medium`.
- Balanced remains `faster`.
- `-threads 0` is passed to all x264 encodes.
- A processing router and capability detector are active.
- FFmpeg remains the only production encoder.
- A performance-monitor class records phase timing and browser heap snapshots where exposed.

The Fast mode is a meaningful codec/encoding tradeoff, not a resolution or frame-rate reduction.

## Quality and memory limitations

- No representative SSIM/VMAF comparison was completed.
- No peak-memory or CPU utilization benchmark was completed.
- No 720p/1080p/4K comparison was completed.
- No controlled same-source preset comparison was completed.
- No browser audio-sync benchmark was completed.
- No browser-restart recovery benchmark was completed.

These remain required before a merge into `main`.
