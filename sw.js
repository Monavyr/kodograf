/* Кодограф PWA service worker: офлайн-кэш оболочки (app shell).
 * Стратегия: network-first для index.html и app-shell-ресурсов (чтобы
 * обновления сайта были видны сразу), cache-first для остальных GET внутри
 * origin, offline-fallback на index.html. Версия кэша меняется при релизе —
 * старые кэши удаляются автоматически. */
const CACHE_NAME = "kodograf-v3";

// App-shell files that must always be fresh when the network is available.
const SHELL_PATHS = ["/", "/index.html", "/app.js", "/core.js", "/styles.css"];

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./core.js",
  "./sw.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./vendor/JsBarcode.all.min.js",
  "./vendor/qrcode.bundle.js",
  "./assets/preview.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Only handle same-origin requests; never touch external URLs.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: network-first so deployments take effect immediately,
  // falling back to cache when offline.
  if (SHELL_PATHS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("./index.html") : new Response("Offline", { status: 503 })))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline navigation fallback to the cached app shell.
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
    })
  );
});
