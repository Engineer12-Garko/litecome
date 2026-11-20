# LiteCompress 2.1 Test Results

Status labels follow the reliability specification:

- **PASSED** — exercised successfully.
- **FAILED** — exercised unsuccessfully.
- **PARTIALLY VERIFIED** — some conditions exercised.
- **NOT TESTED** — not actually exercised.
- **BLOCKED** — testing could not proceed.

## Executed local Chromium checks

| Test | Status | Evidence |
|---|---|---|
| Normal WebM compression | PASSED | Generated WebM input produced a valid MP4 download in Chromium |
| Download availability | PASSED | Download link appeared after browser metadata validation |
| Reload persistence | PASSED | Saved-job card remained after page reload |
| Completed saved job UI | PASSED | Completed jobs show a disabled Completed action |
| Remove saved job | PASSED | Reload no longer showed removed IndexedDB job |
| Clear active jobs | PASSED | Reload no longer restored a cleared queued job |
| Unsupported file | PASSED | Text file was rejected |
| Service worker registration | PASSED | Chromium reported an active controlling worker |
| Storage estimate/fallback | PARTIALLY VERIFIED | Browser storage estimate and persistence APIs were invoked; quota exhaustion was not induced |

## Smart Resume

| Test | Status | Evidence / limitation |
|---|---|---|
| Upload and save metadata | PASSED | IndexedDB job card appeared after reload |
| Completed segment OPFS write | NOT TESTED | Browser runner had no duration-known long MP4 fixture |
| Close browser/reopen | NOT TESTED | Browser automation cannot close the shared browser process reliably |
| Resume first unfinished segment | NOT TESTED | Requires a real duration-known fixture and browser restart |
| Missing source reselection | NOT TESTED | Requires a real persistent source Blob and browser restart |
| Corrupted checkpoint recovery | PARTIALLY VERIFIED | Corrupt/undersized checkpoints are rejected by code; no controlled corrupted fixture was tested |
| Idempotent recovery | NOT TESTED | Requires interrupted batch fixture |

## Video integrity

| Test | Status |
|---|---|
| Browser playback metadata validation | PASSED for generated WebM → MP4 |
| Full beginning-to-end playback | NOT TESTED |
| Audio/video sync | NOT TESTED |
| Segment boundaries | NOT TESTED |
| FFprobe duration/resolution/frame-rate inspection | NOT TESTED |
| SSIM/VMAF | NOT TESTED |

## Storage

| Test | Status |
|---|---|
| IndexedDB unavailable | NOT TESTED |
| OPFS unavailable | NOT TESTED |
| Quota near exhausted/exceeded | NOT TESTED |
| Persistent-storage denial | NOT TESTED |
| Private browsing | NOT TESTED |
| Browser storage cleared | NOT TESTED |

## Offline

| Test | Status |
|---|---|
| Network interruption during active compression | NOT TESTED |
| Network interruption during FFmpeg initialization | NOT TESTED |
| Offline application restart | NOT TESTED |

## Benchmarks

No invented benchmark values are reported. Controlled FPS, output size, peak memory, and ETA error require representative fixture files and browser instrumentation.
