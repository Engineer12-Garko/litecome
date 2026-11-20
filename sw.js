const CACHE_NAME = "litecompress-v3";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/components.css",
  "./css/responsive.css",
  "./js/app.js",
  "./js/file-manager.js",
  "./js/compression-engine.js",
  "./js/compression-worker.js",
  "./js/job-queue.js",
  "./js/preview.js",
  "./js/presets.js",
  "./js/utils.js",
  "./js/persistence-store.js",
  "./js/checkpoint-store.js",
  "./js/capability-detector.js",
  "./js/performance-monitor.js",
  "./js/webcodecs-engine.js",
  "./js/processing-router.js",
  "./vendor/ffmpeg/ffmpeg.js",
  "./vendor/ffmpeg/classes.js",
  "./vendor/ffmpeg/const.js",
  "./vendor/ffmpeg/errors.js",
  "./vendor/ffmpeg/types.js",
  "./vendor/ffmpeg/utils.js",
  "./vendor/ffmpeg/worker.js",
  "./vendor/util/util.js",
  "./vendor/util/const.js",
  "./vendor/util/errors.js",
  "./vendor/core/ffmpeg-core.js",
  "./vendor/core/ffmpeg-core.wasm",
  "./vendor/core/ffmpeg-core-mt.js",
  "./vendor/core/ffmpeg-core-mt.wasm",
  "./vendor/core/ffmpeg-core-mt.worker.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(APP_ASSETS.map((asset) => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});
