const CACHE_NAME = "tjdft-pages-v2";
const LAW_ROUTE_ASSETS = Array.from({ length: 26 }, (_, index) => `./leis/l${String(index + 1).padStart(2, "0")}/index.html`);
const CORE_ASSETS = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./reading-preferences.css",
  "./reading-preferences.js",
  "./leis-enhanced.css",
  "./leis/index.html",
  "./leis/flashcards/index.html",
  ...LAW_ROUTE_ASSETS,
  "./data/tjdft-snapshot.json",
  "./data/tjdft-edital.json",
  "./data/leis-primeiro.json",
  "./data/legislation-bank.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("tjdft-pages-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function cacheKeyFor(request) {
  const key = new URL(request.url);
  key.search = "";
  return key.href;
}

function cacheResponse(request, response) {
  if (!response || !response.ok) return response;
  const copy = response.clone();
  void caches.open(CACHE_NAME).then((cache) => cache.put(cacheKeyFor(request), copy)).catch(() => undefined);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !sameOrigin(request)) return;
  const url = new URL(request.url);
  const acceptsHtml = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  const isStaticAsset = /\.(?:css|js|json|svg|webmanifest|woff2?)$/i.test(url.pathname);

  if (acceptsHtml) {
    // HTML uses a network-first strategy so a fresh snapshot wins whenever it is available.
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => cacheResponse(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }

  if (isStaticAsset) {
    const cacheKey = cacheKeyFor(request);
    const cachedResponse = caches.match(cacheKey);
    const isDataSnapshot = url.pathname.includes("/data/") && url.pathname.endsWith(".json");
    if (isDataSnapshot) {
      event.respondWith(
        fetch(request, { cache: "no-store" })
          .then((response) => cacheResponse(request, response))
          .catch(() => cachedResponse),
      );
      return;
    }
    event.respondWith(
      cachedResponse.then((cached) => {
        const network = fetch(request).then((response) => cacheResponse(request, response)).catch(() => cached);
        return cached || network;
      }),
    );
  }
});
