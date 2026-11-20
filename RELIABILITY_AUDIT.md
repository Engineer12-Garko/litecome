# LiteCompress 2.1 Reliability Audit

Audit state: completed before implementation fixes.

Repository: `main`
Baseline commit: `865b400`
Git status at audit start: clean

## 1. Features correctly implemented

- **IndexedDB metadata persistence:** Job metadata, source Blobs, and compression history are stored in dedicated object stores.
- **OPFS checkpoint storage:** Successful 30-second segment files are written to OPFS and discovered during recovery.
- **Segment encoding:** FFmpeg worker encodes each segment with consistent preset/CRF/audio/pixel settings.
- **Segment assembly:** FFmpeg concat-remux assembles ordered MP4 segment files.
- **Source fingerprinting:** SHA-256 is generated from a 2 MB source sample plus metadata and checked when a missing source is reselected.
- **Progress persistence:** Metadata, completed segment indices, current segment, preset, estimates, elapsed processing time, and status are saved.
- **Queue sequencing:** The batch queue processes one job at a time.
- **Worker cancellation:** Pending workers are rejected and worker instances terminate.
- **Service worker:** Static assets, FFmpeg modules, core, and WASM are cached.
- **Storage estimation:** `navigator.storage.estimate()` triggers a low-storage warning.
- **Fallback processing:** Whole-file encoding is used when OPFS or known duration is unavailable.
- **Download and preview:** Completed output Blob URLs support download and browser preview.
- **Low dependency count:** The implementation remains vanilla HTML/CSS/JavaScript.

## 2. Partially implemented features

- **True smart resume:** Segment state and source checkpoints are persisted, but completed segment corruption/validity is not fully verified.
- **Browser restart recovery:** Metadata and OPFS survive in supporting browsers, but no actual browser restart test has been completed.
- **Missing source recovery:** Reselection is implemented, but verification is based on a sampled fingerprint rather than a full-file digest.
- **Elapsed/ETA:** Elapsed and per-video ETA use measured progress, but batch ETA is not a full queue ETA and estimates are not persistent across reload.
- **Persistent output:** Completed job metadata survives, but actual output Blob/Object URL is not persistently stored.
- **Storage persistence:** `persist()` is requested, but browser denial is not surfaced as a persistent-storage-specific status.
- **Offline cold start:** The service worker exists, but offline cold-start was not production-tested.

## 3. Confirmed bugs

### Critical

- **Clear-all does not clear persistent jobs.**
  `clearButton` clears only memory and object URLs. IndexedDB jobs and sources remain and reappear in “Resume later”.

- **Job removal does not clear persistent recovery data.**
  The per-card remove control does not call `deleteJob()` or `deleteJobFiles()`.

- **Removed/cancelled active jobs can be re-persisted by their async catch path.**
  Removing or clearing an active job terminates the worker, whose `AbortError` catch may call `persistJobState(job)` after the job was removed.

- **Final output is marked complete without independent decoder/output validation.**
  Successful FFmpeg exit and non-empty bytes are insufficient evidence that the MP4 has valid metadata, duration, audio, or beginning-to-end playback.

### High

- **Completed segment count is not validated before assembly.**
  `segmentExists()` only checks whether a file handle exists. An interrupted write may leave a non-empty or invalid partial file.

- **Resume does not initialize progress from already completed segments.**
  `processJob()` resets progress to zero before the loop rechecks completed segments.

- **Preset identity can disagree with the active UI during resume.**
  `processJob()` assigns `presetKey = elements.presetSelect.value` even if resumed metadata belongs to another preset.

- **Completed saved jobs offer a re-encoding “Resume” action but retain no downloadable output.**
  This is misleading and can unnecessarily repeat work.

- **Asynchronous source and job writes do not expose storage failure to the recovery UI clearly.**
  `persistenceAvailable` is set on failure, but no durable recovery warning is displayed for every failed write.

- **Segment assembly loads every segment into FFmpeg memory.**
  It can materially increase peak memory and fail for large batch segments even though encoding is sequential.

- **Source fingerprint is not a full-file hash.**
  The implementation hashes only the source head and tail. It can reject edited files safely, but it cannot guarantee source identity.

### Medium

- **No stale ETA reset on refresh/recovery.**
  Persisted completed processing time is retained, but wall-clock ETA is recalculated from a stale in-memory progress state.

- **Batch ETA is only current-video ETA.**
  Queue length is not incorporated.

- **History write is not awaited or guarded.**
  `putHistory()` is called without a catch or awaited transaction.

- **IndexedDB database connections are opened for every transaction and never closed.**
  This may produce resource pressure during frequent checkpoints.

- **Blocked IndexedDB open has no `onblocked` handling.**
  It can leave metadata calls pending while another tab owns an old database version.

- **Service worker cache is stale-priority.**
  Cached assets are always returned before a network refresh, so deployed updates can require an extra visit.

- **Service worker `addAll()` makes installation fail if one asset is missing.**
  A single missing file prevents all required assets from becoming cached.

- **CSP disables no unsafe inline only enough to block dynamic inline styles.**
  The current `'unsafe-inline'` allowance is broader than necessary.

### Low

- `elapsedEncodingMs` is declared but unused.
- `getSegment()` is unused by the main application.
- Normal whole-file output is not cleaned by a persistent OPFS result path.
- No accessible status announcement exists for recovery and pause transitions beyond toast text.

## 4. Reliability risks

- Browser eviction can remove OPFS/IndexedDB even after `persist()` succeeds or is denied.
- Quota exceeds can occur while storing source Blobs, especially for multi-gigabyte videos.
- Private-browsing storage and Firefox OPFS behavior can differ.
- FFmpeg segment timestamps may differ between source containers and GOP boundaries.
- A single corrupted OPFS file can invalidate final assembly even if metadata marks it complete.
- Service worker scope and update behavior require deployment verification.
- Browser closure can occur before an asynchronous IndexedDB write completes.

## 5. Missing tests

- Actual browser close/reopen and segment resume
- Browser restart/device restart
- Corrupted and missing OPFS segment files
- IndexedDB unavailable/blocked/private-mode
- Quota exceeded during source or segment writes
- OPFS unavailable
- Offline cold start
- Network interruption during initialization and encoding
- Final output duration/audio/decoder validation
- Chromium, Edge, and Firefox matrix
- 1, 3, and 5-video batch recovery
- Large (>1 GB) source handling
- FFmpeg preset output and SSIM/VMAF benchmarks

## 6. Recommended fixes ranked

1. Fix clear/remove persistent cleanup and active-job resurrection.
2. Initialize resumed progress and segment state from verified checkpoints.
3. Keep the saved preset fixed across resume.
4. Validate final output using browser decode and duration metadata before completion.
5. Validate checkpoints as non-empty and decodeable before assembly; recover or reencode invalid segments.
6. Improve source verification messaging and sample/full-file fingerprint limitations.
7. Persist pause/interruption status synchronously at lifecycle boundaries.
8. Add total-batch ETA and persist/reset ETA appropriately.
9. Improve storage-failure UI and quota handling.
10. Strengthen service worker cache fallback and asset installation.
11. Add formal test plan and browser evidence documents.

## Fixes applied after audit

- Per-card remove now deletes IndexedDB metadata/source and OPFS files.
- Clear-all now tombstones active jobs and removes persistent metadata/checkpoints for listed jobs.
- Before-unload marks active jobs as interrupted and persists them.
- Removed-job async catch paths are blocked from re-persisting removed jobs.
- Final output is validated by browser video metadata/decoding before completion.
- New segment results are validated before OPFS write.
- Existing checkpoints are checked for size and browser decodability; invalid files are deleted and reencoded.
- Completed segment progress initializes recovery state before the resume loop.
- Resumed jobs preserve the saved preset instead of replacing it with the current UI selection.
- Completed saved jobs show a disabled Completed action instead of offering repeat compression.
- Saved source verification includes filename and original size in addition to sampled SHA-256.
- Batch ETA now includes remaining jobs using observed current-video ETA.
- Service worker cache installation tolerates individual asset failures and uses network-first fallback.
- Historical put operations are guarded from unhandled promise rejection.

## Audit test status

- **Code audit:** PASSED
- **Normal WebM compression:** PASSED in earlier local browser validation
- **Saved metadata reload:** PASSED in earlier local browser validation
- **Browser restart segment resume:** NOT TESTED
- **OPFS corruption recovery:** NOT TESTED
- **Storage quota exhaustion:** NOT TESTED
- **Offline cold start:** NOT TESTED
- **Chromium/Edge/Firefox matrix:** NOT TESTED
- **Video integrity and benchmark suite:** NOT TESTED
