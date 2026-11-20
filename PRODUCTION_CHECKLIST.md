# LiteCompress Production Checklist

## Repository

- Static-site `render.yaml`: PRESENT
- Publish directory: `.`
- Build command: intentionally empty
- Backend: NOT PRESENT
- External video-processing API: NOT PRESENT

## Assets

- FFmpeg modules vendored locally: PASSED
- FFmpeg core WASM vendored locally: PASSED
- WASM MIME type: Render must verify `application/wasm`
- Service worker: PRESENT
- Asset scope: repository root

## Security

- Local-only video processing: PASSED
- Referrer policy: PRESENT
- `X-Frame-Options`: PRESENT
- `X-Content-Type-Options`: PRESENT
- CSP: PRESENT
- No unsafe COOP/COEP header required by current FFmpeg configuration: NOT ADDED

## Production status

- Production URL: NOT PROVIDED
- Production deployment: NOT TESTED
- Production compression: NOT TESTED
- Production download: NOT TESTED
- Production offline cold start: NOT TESTED
- Production recovery: NOT TESTED

## Required before declaring production-ready

1. Deploy `main` to the production Render Static Site.
2. Verify MIME types for `.wasm` and ES modules.
3. Test normal MP4/WebM compression on production.
4. Test download and output playback.
5. Complete browser close/reopen segment recovery.
6. Test storage quota and unavailable APIs.
7. Test offline cold start.
8. Confirm no console or CSP errors.
