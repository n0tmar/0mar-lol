/* 0mar.lol service worker — public-page caching plus admin Web Push. */
const STATIC_PREFIX = "/_next/static/";
const CACHE = "omar-v3";
const OFFLINE_URL = "/";
const IS_DASHBOARD_HOST = self.location.hostname.startsWith("dashboard.");

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Dashboard service worker exists only for admin Web Push. Never persist
  // authenticated HTML or hidden supporter avatars in Cache Storage.
  if (!IS_DASHBOARD_HOST) {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" ? payload.title : "تعليق جديد";
  const body = typeof payload.body === "string" ? payload.body : "وصلك تعليق جديد.";
  const url = typeof payload.url === "string" ? payload.url : "/dashboard/comments";
  const tag = typeof payload.tag === "string" ? payload.tag : "admin-comment";
  const timestamp = typeof payload.timestamp === "number" ? payload.timestamp : Date.now();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag,
      timestamp,
      renotify: true,
      dir: "rtl",
      lang: "ar",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const fallback = new URL("/dashboard/comments", self.location.origin);
      let target = fallback;
      try {
        const candidate = new URL(event.notification.data?.url || fallback.pathname, self.location.origin);
        if (candidate.origin === self.location.origin) target = candidate;
      } catch {}

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );

      if (existing) {
        if ("navigate" in existing) {
          try {
            await existing.navigate(target.href);
          } catch {}
        }
        return existing.focus();
      }

      return self.clients.openWindow(target.href);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache APIs, cross-origin requests, authenticated dashboard HTML,
  // or framework RSC payloads. RSC payloads drive client navigations —
  // serving a cached copy is what made pages look stale until a full
  // refresh. They must always go straight to the network.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }
  if (
    (IS_DASHBOARD_HOST && !url.pathname.startsWith(STATIC_PREFIX)) ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname === "/unsubscribe"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Static chunks: cache-first (immutable content, hashed filenames).
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches
                .open(CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Public pages: network-first, then last cached page or home fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            void caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Other same-origin assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches
            .open(CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
      return cached || network;
    }),
  );
});
