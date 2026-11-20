# LiteCompress

LiteCompress is a privacy-first, static video compression web application. It uses FFmpeg.wasm to process videos entirely in the browser and never uploads them.

## Run locally

Serve the repository with any static server, for example:

```bash
npx serve .
```

Because the application uses ES modules and a Web Worker, open it through HTTP rather than by opening `index.html` directly.

## Render deployment

- Repository: push this project to GitHub.
- Render service: **Static Site**
- Build command: leave empty.
- Publish directory: `.` (repository root).
