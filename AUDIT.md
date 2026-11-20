# LiteCompress Baseline Audit

## Scope

Baseline audit completed before implementation changes. It covers the HTML, CSS, JavaScript modules, worker pipeline, FFmpeg assets, queue behavior, previews, memory lifecycle, privacy, and deployment configuration.

## Executive findings

1. The app is genuinely browser-local and does not call a video-processing API.
2. FFmpeg assets are now served locally, avoiding a cross-origin worker failure.
3. Sequential compression is present and prevents simultaneous encoding.
4. The baseline has several correctness and lifecycle defects that can hang or corrupt batch behavior.
5. Encoding quality is not benchmarked; no preset-speed or visual-quality claim can be made from source inspection alone.

## Finding severity

### Critical

- **FFmpeg output copy may retain or copy an oversized WASM backing buffer.** `readFile()` returns a `Uint8Array`; wrapping `data.buffer` can include unrelated bytes and has caused unstable memory/size behavior. Use the exact byte range.
- **Clearing or canceling a running batch can leave compression promises unresolved.** `Worker.terminate()` does not settle `CompressionEngine` promises, so the queue may remain permanently waiting.

### High

- **No cancellation support exists.** There is no queue cancellation, individual job cancellation, or pending-worker rejection path.
- **Removing a job during compression leaves queue and worker state inconsistent.** The removed job may continue to process and later be rendered by an orphaned reference.
- **Concurrent file-selection calls can duplicate jobs.** Duplicate detection is only checked against already-pushed jobs, not while metadata reading is in progress.
- **Metadata loading has no timeout.** Corrupt or unusual media can leave file addition pending indefinitely.
- **Metadata jobs are processed serially.** Multiple uploads unnecessarily wait one video at a time before appearing in the UI.
- **The selected preset is read for every job at execution time.** Changing the preset mid-batch can produce mixed settings.
- **Original preview is replaced after compression.** The completed card switches to the compressed preview, without a deliberate original/compressed comparison.
- **Worker engine initialization has weak failure cleanup.** A failed `ffmpeg.load()` leaves partial state and can produce a second retry against a dead worker.
- **Error cleanup is incomplete.** Progress listeners are not removed when `exec()` throws.

### Medium

- `renderAllJobs()` re-renders every card after any individual removal or upload batch change.
- Object URLs are revoked correctly for job removal/clear, but output video URLs are not revoked if browser shutdown is not followed by `beforeunload`.
- The drag-and-drop zone has nested interactive semantics and the drop counter does not handle `dragleave` reliably for child elements.
- `-vf scale=trunc(iw/2)*2:trunc(ih/2)*2` can alter odd-sized content and should retain display resolution and sample aspect ratio where possible.
- No metadata/rotation policy is explicit.
- Progress can briefly report a value outside 0–100 or become less than its prior value.
- Corrupt output may be reported complete if FFmpeg returns zero despite an empty or invalid file.
- The size comparison shows “0% smaller” rather than explaining a larger output.
- Large uploads are warned only after metadata processing starts.
- The default H.264 output can remain unencoded on browsers lacking H.264 playback support, although FFmpeg.wasm itself does support encoding.

### Low

- `ffmpegModule` is assigned but unused.
- The brand link uses `href="#"`, which scrolls to the top unexpectedly.
- The CSS includes a `--danger` token without an error component.
- There is no Content-Security-Policy or static deployment cache header configuration.
- FFmpeg licensing notices are not bundled alongside the vendored distribution.

## Correctness positives

- The batch loop uses `await` for each job, so encoding is sequential.
- A job-level error is caught and does not throw out of the queue.
- H.264 and AAC arguments are valid FFmpeg concepts.
- CRF, audio bitrate, and resolution preserve the current quality-first philosophy.
- Temporary virtual-filesystem input/output names are cleaned in `finally`.
- The worker posts only blob data and no video data to a server.

## Limits of baseline measurement

- No test video or FFmpeg benchmark was available in the workspace, so source inspection cannot establish encoding FPS or output-size deltas.
- Browser peak-memory measurements, SSIM/VMAF, and x264 preset comparisons require a real browser plus representative fixtures.
- Baseline UI loading and FFmpeg initialization were not time recorded before changes.

## Changes implemented

- Added cancellation to the worker and queue, including worker termination and pending-promise rejection.
- Added `AbortError` handling so cancelled jobs return to a recoverable queued state.
- Fixed duplicate upload detection while metadata reads are in progress.
- Added metadata timeout handling.
- Parallelized metadata reads for a batch.
- Pinned a preset snapshot for the entire batch.
- Switched the H.264 encoding preset to `faster` for High Quality remains on `medium`; Balanced and Smaller File use `faster` while preserving CRF and resolution policy.
- Added exact-byte handling for FFmpeg output buffers.
- Added output validation for empty FFmpeg results.
- Removed progress listeners in every worker exit path.
- Added progress monotonic clamping.
- Added original/compressed preview modal.
- Added a size comparison for both smaller and larger outputs.
- Added a static security-header configuration and browser CSP.
- Reset and terminated worker state after failures.

## Validation status

- **Valid WebM input:** passed; generated WebM output was encoded and a download link was produced.
- **Unsupported file:** passed; a text file was rejected before job creation.
- **Compressed preview/download:** passed in-browser.
- **Original/compressed preview modal:** passed in-browser.
- **Batch cancellation:** exercised with a real 274 MB MP4; progress stopped and the UI returned to the idle state.
- **Missing or failed FFmpeg assets:** handled through the worker error path, but a production CDN outage is eliminated because core assets are vendored locally.
- **Preset benchmarking:** not executed with controlled x264 preset fixtures; no FPS or file-size claims are included.
- **SSIM/VMAF:** unavailable in the workspace runtime and not claimed.
- **Peak memory:** unavailable through the automated browser; no measured peak-memory claim is included.
