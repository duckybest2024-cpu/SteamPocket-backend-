const CACHE = "casino-aurelius-v2";
const STATIC = [
  "/",
  "/css/style.css",
  "/js/api.js",
  "/js/ui.js",
  "/js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept API calls, socket.io, or auth
  if (url.pathname.startsWith("/auth") ||
      url.pathname.startsWith("/wallet") ||
      url.pathname.startsWith("/admin") ||
      url.pathname.startsWith("/games") ||
      url.pathname.startsWith("/socket.io") ||
      url.pathname.startsWith("/nfts") ||
      url.pathname.startsWith("/nftmarket") ||
      e.request.method !== "GET") {
    return;
  }

  // Static assets: network-first so fixes deploy immediately, fall back to cache offline
  if (url.pathname.startsWith("/css/") || url.pathname.startsWith("/js/")) {
    e.respondWith(
      fetch(e.request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML: network-first so updates deploy immediately, fall back to cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
