# LiteCompress Browser Compatibility

Status labels:

- **PASSED**
- **FAILED**
- **PARTIALLY VERIFIED**
- **NOT TESTED**
- **BLOCKED**

| Capability | Chromium | Edge | Firefox |
|---|---|---|---|
| Web Workers | PASSED | NOT TESTED | NOT TESTED |
| ES modules | PASSED | NOT TESTED | NOT TESTED |
| IndexedDB | PASSED reload persistence in Chromium | NOT TESTED | NOT TESTED |
| OPFS | Chromium API available; segment fixtures not completed | NOT TESTED | NOT TESTED |
| StorageManager estimate/persist | PARTIALLY VERIFIED | NOT TESTED | NOT TESTED |
| Service worker | PASSED registration | NOT TESTED | NOT TESTED |
| FFmpeg.wasm core | PASSED local Chromium encode | NOT TESTED | NOT TESTED |
| Blob/File handling | PASSED | NOT TESTED | NOT TESTED |

## Compatibility notes

- OPFS is feature-detected and whole-file fallback is used when unavailable.
- IndexedDB is feature-detected and normal compression remains independent of metadata persistence.
- Persistent storage permission can be denied; storage persistence is not assumed.
- Firefox and Safari details are not claimed beyond feature detection.
