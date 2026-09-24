const CACHE_NAME = "tjdft-pages-v3";
const LAW_ROUTE_ASSETS = Array.from({ length: 26 }, (_, index) => `./leis/l${String(index + 1).padStart(2, "0")}/`);
const STUDY_CODES = [
  "p01", "p02", "p03", "rl01", "p04", "rev01", "p05", "p06", "rl02", "p07", "p08", "rev02",
  "p09", "rl03", "p10", "p11", "p12", "rev03", "rl04", "p13", "p14", "p15", "rl05", "rev04",
  "p16", "p17", "p18", "rl06", "rl07", "rev05", "rl08", "rl09", "rl10", "rl11", "rl12", "rev06", "rl13",
];
const STUDY_ROUTE_ASSETS = STUDY_CODES.map((code) => `./portugues-rlm/${code}/`);
const STUDY_OS_ROUTES = [
  "hoje", "mentor", "trilha", "agenda", "revisoes", "erros", "desempenho", "riscos",
  "tecnico", "analista", "qualidade-dados", "sincronizacao", "painel-legado",
].map((route) => `./${route}/`);
const CORE_ASSETS = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./reading-preferences.css",
  "./reading-preferences.js",
  "./leis-enhanced.css",
  "./leis/",
  "./leis/flashcards/",
  ...STUDY_OS_ROUTES,
  ...LAW_ROUTE_ASSETS,
  "./portugues-rlm/",
  "./portugues-rlm/flashcards/",
  ...STUDY_ROUTE_ASSETS,
  "./data/tjdft-snapshot.json",
  "./data/tjdft-edital.json",
  "./data/leis-primeiro.json",
  "./data/portugues-rlm.json",
  "./data/legislation-bank.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(CORE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined))))
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

async function cacheResponse(request, response) {
  if (!response || !response.ok) return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKeyFor(request), response.clone());
  } catch {
    // Keep the network response available even if this entry cannot be cached.
  }
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
