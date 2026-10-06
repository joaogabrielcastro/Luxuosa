/* Cache somente de recursos públicos da marca; telas e dados autenticados ficam fora. */
const CACHE = "luxuosa-public-assets-v2";
const PUBLIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];
const PUBLIC_PATHS = new Set(PUBLIC_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!PUBLIC_PATHS.has(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
