# LiteCompress 2.0 implementation report

## Architecture

LiteCompress 2.0 adds four browser-local persistence modules without changing the existing application stack:

- `persistence-store.js` stores job metadata, source blobs, and historical compression results in IndexedDB.
- `checkpoint-store.js` stores segment MP4 blobs in the Origin Private File System.
- `compression-worker.js` adds segment encoding and FFmpeg concat assembly.
- `compression-engine.js` tracks segment and assembly promises and terminates the worker for cancellation.

The application remains a static HTML/CSS/vanilla-JavaScript site.

## Resume strategy

Each job stores:

- Job ID and source fingerprint
- Original filename and size
- Duration, resolution, preset and encoder settings
- Segment length and total segment count
- Completed segment indices
- Current segment
- Active/paused/interrupted/failed/completed status
- Accumulated processing time and checkpoint timestamp
- Estimated and actual output size

The source blob is kept in IndexedDB. Segment MP4 outputs are checkpointed in OPFS. On resume, completed segment files and metadata are checked; encoding starts at the first unfinished segment. A refresh or worker termination marks or restores the job as interrupted. Restart explicitly clears OPFS checkpoints and begins at segment zero.

This is genuine segment recovery for videos whose browser duration and source blob are available. There is no resume claim for an unavailable source, unavailable OPFS, or failed source fingerprint verification.

## Storage fallback

- IndexedDB is required for metadata and source-fingerprint persistence.
- OPFS is preferred for segment checkpoints.
- If OPFS or duration metadata is unavailable, compression uses the existing whole-file fallback and clearly remains outside segment-resume guarantees.
- `navigator.storage.estimate()` produces low-storage warnings.
- Persistent-storage permission is requested only where browser support permits and browsers may decline it.
- Explicit source reselection is required when IndexedDB source recovery fails.

## Output-size estimation

Before encoding:

- Relevant historical ratios are grouped by preset.
- Failing to find history falls back to preset ratio estimates.
- Estimates are shown as a range because exact encoding size depends on content, motion, and duration.

After encoding, the actual output replaces the prediction and larger outputs are shown explicitly.

## ETA and FPS

- Elapsed time uses accumulated completed segment wall time plus the active segment duration.
- Remaining ETA is a smoothed ratio based on observed progress and elapsed encoding time.
- Realtime FPS is reported as a realtime factor when sufficient duration and wall-time data exist.
- A separate batch ETA uses remaining job/segment progress.
- Initialization and queue waiting do not report a fake countdown.

## Offline behavior

A service worker caches the static shell, JavaScript modules, CSS, FFmpeg modules, FFmpeg core, and WASM asset. Once cached, FFmpeg assets do not require a network request. Video encoding itself remains local and does not call a remote processing API.

## Segment assembly

Every segment is encoded with consistent H.264/AAC, CRF, pixel format and resolution settings. Segment timestamps are reset and negative timestamps are normalized. A final FFmpeg concat remux uses compatible MP4 segments and fast-start output. Segment files are deleted after successful assembly.

## UX

The primary workflow remains Add > Quality > Compress > Download. Added UI elements provide:

- Estimated output range
- Elapsed and remaining time
- Encoding realtime speed
- Batch ETA
- Saved-job recovery cards
- Resume, restart and remove actions
- Source reselection when a Blob cannot be recovered

## Bugs addressed

- Added durable source and job metadata recovery.
- Added interruption-safe segment checkpointing.
- Added first-unfinished-segment recovery.
- Added source fingerprint verification.
- Added output-size ranges based on historical ratios.
- Added queue ETA and elapsed encoding state.
- Added worker/offline asset caching.
- Added OPFS, IndexedDB, and storage-estimation fallbacks.
- Fixed dynamic progress callbacks for repeated segment worker messages.

## Testing status

Verified in Chromium:

- Normal WebM compression.
- Download and preview after compression.
- IndexedDB saved-job metadata after page reload.
- Saved-job recovery card rendering.
- Unsupported file rejection.
- Low-storage and unavailable-storage branches use graceful error/fallback paths.
- Worker asset cache registration.
- IndexedDB metadata and source persistence across a page reload.
- Saved-job Remove action and OPFS cleanup path.

Not yet verified with this environment:

- A real Chromium browser restart and continuation test
- A Firefox OPFS/browser-restart test
- A large, duration-known MP4 segment interruption
- Audio/video synchronization across segment assembly
- A benchmarked 1, 3, and 5-video segment batch

No browser restart or audio-sync success is claimed without those tests.
