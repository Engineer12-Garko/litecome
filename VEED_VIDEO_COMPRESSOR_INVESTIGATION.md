# VEED.io Video Compressor Investigation

Observation date: 2026-11-21
Browser: Chromium 150 embedded in VS Code/Electron
Scope: public compressor page and public frontend resources only

## Executive summary

The VEED compressor workflow is confirmed to use:

- VEED's public `/tools/video-compressor` Next.js marketing page.
- A client editor route: `/edit/{project-id}/compress`.
- A cloud project identity for the uploaded media.
- A visible upload phase.
- A dedicated compressor settings UI.
- A server/CDN output URL for the final MP4.
- A public `WasmRenderLib.wasm` frontend resource.
- Public canvas/render worker resources.
- Public metadata extraction code containing a MediaInfoModule.

The workflow does **not** establish that VEED compresses videos locally. In the observed real-MP4 test, the browser displayed “Starting upload…” and “Uploading…”, and the final result was served from `cdn-user-temp.veed.io/render/...`. This strongly indicates remote or hybrid processing, but server implementation remains unconfirmed.

The public frontend is not evidence that `WasmRenderLib.wasm` is the compression encoder. It is consistent with rendering/previews/compositing.

## 1. Confirmed compression workflow

1. The public compressor page showed the hero CTA “Compress a video”.
2. The CTA created a project route:
   `https://www.veed.io/edit/{project-id}/compress`
3. The editor opened a “Compress a Video” modal.
4. The modal accepted MP4/MOV/AVI/WebM/WMV/MKV/MPEG/3GP/FLV/TS and media/image/audio variants.
5. Selecting a real 574.8 kB MP4 caused:
   - “Starting upload…”
   - “Uploading…”
6. After upload, the editor displayed:
   - Original resolution: 640 × 360
   - Quality: Medium
   - A compression settings panel
   - “Compress Video”
7. Clicking “Compress Video” produced:
   - “Same video, now 11% smaller!”
   - Output: 514.2 kB
   - Original: 574.8 kB
   - Reduction: 60.6 kB
8. The final output was available from:
   `https://cdn-user-temp.veed.io/render/{render-id}.mp4`
9. The UI offered:
   - Download file
   - Adjust compression settings
   - Compress another file

## 2. Workflow diagram

```text
Public VEED compressor landing page
  -> Create project route
  -> Editor upload modal
  -> Browser file selection
  -> Visible upload state
  -> Project/editor media state
  -> Compress settings: quality/resolution
  -> Render/compression request
  -> Render progress/result
  -> cdn-user-temp.veed.io MP4
  -> Download
```

## 3. Public resources and modules

Confirmed public resources:

- `CompressorOptionsModal-jBVRhhT3.js`
- `worker-CoPOjrSH.js`
- `CanvasRenderer-b53Nbifa.js`
- `WasmRenderLib.wasm?v=3.19.14`
- `get-complete-media-metadata-CaRVhSRO.js`
- `getRenderQueueListener-DVNw33ue.js`

The public canvas renderer bundle contained WebAssembly, OffscreenCanvas/canvas, Worker and WebCodecs-related code. This establishes that VEED's editor has WASM/canvas/worker capabilities; it does not prove that compression is performed by that WASM module.

The public MediaInfo metadata module explicitly references `MediaInfoModule.wasm`. That resource was referenced by code but was not observed in this browser session’s relevant resource list.

The compressor options bundle contained a render-queue listener import and compression result UI. It did not contain directly observable FFmpeg or public direct encode API calls.

## 4. Browser/network findings

Confirmed:

- VEED resources are served from `www.veed.io`.
- Static assets use `static-assets.veed.io` and `cdn.veed.io`.
- Rendering outputs use `cdn-user-temp.veed.io`.
- Analytics and tracking resources were also visible.
- A project identifier is created before/while entering the editor.
- The real test file showed an upload phase.
- The final output used a render CDN URL.

Observed public resource:

- `WasmRenderLib.wasm`
- Encoded resource size: 714,407 bytes
- Decoded size: 2,328,279 bytes
- Fetch duration: approximately 627 ms in the browser resource timing data

The exact upload endpoint, HTTP method, signed URL, render endpoint, and polling protocol were not recorded in a non-sensitive final network trace. No authentication data, signed URL, cookie, or token is included in this report.

## 5. Confirmed architecture versus unknowns

### Confirmed

- Browser editor with project route.
- Browser file selection and upload state.
- Browser metadata/preview/editor resources.
- Public WASM renderer resource.
- Public CanvasRenderer and worker assets.
- Public MediaInfo metadata code.
- Server/CDN-hosted render output URL.
- Quality and resolution settings in the editor.

### Strongly indicated

- The compression operation is remote or hybrid.
- The browser uploads the source or obtains a server-accessible media copy.
- The output is rendered or encoded outside the browser and exposed by `cdn-user-temp.veed.io`.

### Unknown

- Whether an FFmpeg, proprietary renderer, cloud transcoder, or mixed pipeline performs compression.
- Whether browser rendering is used for previews only.
- Whether WebCodecs is used anywhere in the editor.
- Whether hardware acceleration is used by the cloud pipeline.
- How progress is calculated or polled.
- Whether output encoding has GPU acceleration.
- Whether the upload or render uses chunking, resumable requests, or queues.
- Whether the browser downloads, transcodes, or re-uploads media during output preparation.

## 6. Measured test

### Input

- 574.8 kB MP4 observed in VEED's UI
- 640 × 360 original resolution
- Medium quality
- Public-file test size

### Output

- 514.2 kB MP4
- 60.6 kB smaller
- 11% smaller
- MP4 served from `cdn-user-temp.veed.io`

### Repeated benchmark status

- Three file-size classes: NOT TESTED
- Repeated median tests: NOT TESTED
- Cold versus warm editor load: NOT TESTED separately
- Upload time exact: NOT TESTED
- Encoding time exact: NOT TESTED
- Total time exact: NOT TESTED
- Peak memory: NOT TESTED
- Main-thread blocking: NOT TESTED
- Output quality/SSIM/VMAF: NOT TESTED
- Audio sync: NOT TESTED
- Download integrity: NOT FULLY VERIFIED

## 7. LiteCompress comparison

LiteCompress is browser-local:

- HTML/CSS/ES modules
- FFmpeg.wasm
- Dedicated worker
- IndexedDB
- OPFS
- Local object URLs
- No remote video-processing API

The VEED observation does not prove an architecture advantage for LiteCompress. It only confirms that VEED can present a render pipeline with browser/editor resources and a cloud media output.

## 8. Independent optimisation opportunities

1. Keep FFmpeg whole-file fallback where it is faster and more reliable.
2. Measure engine initialisation separately from encode time.
3. Avoid segmenting short videos merely for checkpointing.
4. Stream checkpoint storage instead of duplicating every segment in memory.
5. Reduce source copying in FFmpeg VFS.
6. Keep worker reuse and module reuse.
7. Use metadata and cache data only once per file.
8. Use output Blob URLs only for preview/download and revoke immediately when replaced.
9. Add a measured engine comparison rather than assuming WebCodecs or hardware acceleration is faster.
10. Preserve a transparent local-only UI; do not copy VEED's upload behavior.

## 9. Prioritised roadmap

### P0

- Add repeatable benchmark fixtures.
- Instrument phase timing.
- Benchmark whole-file FFmpeg against 30-second segments.
- Verify whether segmentation is slower than whole-file encoding.

### P1

- Reduce FFmpeg input/output copying.
- Add bounded OPFS streaming.
- Improve worker reuse and cancellation.
- Add output integrity checks before completion.

### P2

- Prototype WebCodecs with a real demux/mux library.
- Validate audio, timestamps, variable frame rate and rotation.
- Add hardware acceleration only behind `isConfigSupported()` and output regression tests.

### P3

- Add multithread FFmpeg only with verified cross-origin isolation.
- Benchmark 720p, 1080p and 4K.
- Produce repeated median/SSIM/VMAF reports.

## 10. Final assessment

VEED is confirmed to run a browser editor and upload the media before the compressor UI reaches an output. It also exposes browser WASM/worker/canvas/editor resources and returns the final MP4 from a VEED render CDN. The exact server transcoder and any browser-side encoding remain unknown.

No encoder names, backend technologies, private endpoints, hardware acceleration claims, or performance estimates should be inferred from this public observation without further controlled testing.
