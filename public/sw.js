/* Plenary service worker.
 *
 * What it does
 *  - App files (/_next/static, icons, fonts) are content-hashed: served from cache first, so the app
 *    opens instantly and works on a flaky connection.
 *  - Public pages (landing, venues, a venue, sign-in, legal, offline) are network-first and saved
 *    for offline reading.
 *  - Private pages (workspace, submissions, anything signed-in) are NEVER stored on the device:
 *    network only, with the offline page as fallback. Same for server actions, auth, RSC requests,
 *    receipts and calendar files.
 *  - A new version waits until the user clicks "Reload" in the update toast (message SKIP_WAITING).
 *
 * Keep VERSION in sync with components/pwa/constants.ts.
 */
const VERSION = "v1";
const STATIC_CACHE = `plenary-static-${VERSION}`;
const PAGE_CACHE = `plenary-pages-${VERSION}`;
const LOCALES = ["en", "fr", "it", "de"];
const OFFLINE_URLS = LOCALES.map((l) => `/${l}/offline`);
const PRECACHE = [...OFFLINE_URLS, "/icons/icon-192.png", "/icons/icon.svg", "/manifest.webmanifest"];
const LANG_KEY = "/__plenary-lang";
const MAX_STATIC = 300;
const MAX_PAGES = 40;

const LOCALE = "(?:(?:en|fr|it|de)(?:/|$))?";
const PUBLIC_PAGE = new RegExp(`^/${LOCALE}(?:venues(?:/[a-z0-9-]+)?|sign-in|forgot-password|account-help|offline|legal/[a-z-]+)?/?$`);
const NEVER = [/^\/auth\//, /^\/api\//, /\/receipt\.pdf$/, /\/calendar\.ics$/, /^\/sign-up$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // The offline page goes in the page cache; failures must not block installation.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload", credentials: "omit" });
            if (res.ok) await (OFFLINE_URLS.includes(url) ? (await caches.open(PAGE_CACHE)).put(url, res) : cache.put(url, res));
          } catch { /* offline during install: fine */ }
        }),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      for (const key of await caches.keys()) if (key.startsWith("plenary-") && !keep.has(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGE_CACHE));
  // The page tells us its language, so the offline page can be shown in it.
  if (event.data && event.data.type === "LANG" && LOCALES.includes(event.data.lang)) {
    event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.put(LANG_KEY, new Response(event.data.lang))));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    trim(STATIC_CACHE, MAX_STATIC);
  }
  return res;
}

async function offlinePage(url) {
  const cache = await caches.open(PAGE_CACHE);
  const prefix = url ? url.pathname.split("/")[1] : "";
  const saved = await cache.match(LANG_KEY).then((r) => (r ? r.text() : null)).catch(() => null);
  const nav = (self.navigator.language || "en").slice(0, 2).toLowerCase();
  const lang = [prefix, saved, nav].find((l) => LOCALES.includes(l)) || "en";
  return (await cache.match(`/${lang}/offline`, { ignoreVary: true })) || (await cache.match("/en/offline", { ignoreVary: true })) ||
    new Response("<h1>You’re offline</h1><p>Reconnect to continue.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function publicPage(event) {
  const { request } = event;
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = (await event.preloadResponse) || (await fetch(request));
    // Only store plain successful pages (not redirects to sign-in, not errors).
    if (res.ok && !res.redirected && res.type === "basic") {
      await cache.put(new URL(request.url).pathname, res.clone());
      trim(PAGE_CACHE, MAX_PAGES);
    }
    return res;
  } catch {
    return (await cache.match(new URL(request.url).pathname, { ignoreVary: true })) || offlinePage(new URL(request.url));
  }
}

async function privatePage(event) {
  try {
    return (await event.preloadResponse) || (await fetch(event.request));
  } catch {
    return offlinePage(new URL(event.request.url));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;
  // React Server Component / router requests: always live (they carry per-user data).
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(PUBLIC_PAGE.test(url.pathname) && !url.search.includes("next=") ? publicPage(event) : privatePage(event));
  }
});
