/* Minimal private-monitor PWA shell, versioned separately from public site.
 * Cache STATIC APP ASSETS only; never monitor API requests, credentials,
 * private response bodies or URLs that could contain pairing tokens. */
const CACHE = "starlink-phone-shell-160";
const STATIC = [
  "/live/",
  "/phone.js?v=160",
  "/phone.css?v=153",
  "/phone-refine.css?v=153",
  "/ui-icons.css?v=153",
  "/ui-icons/home-02.svg",
  "/ui-icons/coins-01.svg",
  "/ui-icons/layers-three-01.svg",
  "/ui-icons/wifi.svg",
  "/ui-icons/refresh-cw-01.svg",
  "/ui-icons/activity.svg",
  "/ui-icons/monitor-01.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/starlink-mark.svg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(STATIC.map((asset) => cache.add(asset)))),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("starlink-phone-shell-") && key !== CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Do NOT even examine request headers or handle /api, including when offline.
  if (
    url.pathname.startsWith("/api/") ||
    !STATIC.some((s) => s === url.pathname + url.search || s === url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error()),
  );
});
