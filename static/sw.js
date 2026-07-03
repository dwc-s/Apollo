/* Apollo service worker — PWA shell + offline support.
 *
 * Goals:
 *   1. Make the app installable and openable without a connection.
 *   2. Keep the /sesh shooting screen renderable offline so the
 *      offline shot queue (apollo-offline.js) has a UI to draw into.
 *   3. Never wedge a client on a stale (or cached-broken) asset. A new
 *      deploy's CSS/JS — and a transient CDN error — must heal on the
 *      next load, not require a manual hard refresh.
 *
 * Strategy:
 *   - Navigations (/sesh, /): network-first, falling back to the last
 *     cached copy so the target screen still opens with no signal.
 *   - Same-origin CSS & JS: stale-while-revalidate. Served instantly from
 *     cache (fast, offline-capable) but re-fetched in the background every
 *     load, so a new style.css / apollo-predict.js lands on the next visit
 *     without a hard refresh.
 *   - Other same-origin /static assets (images, icons, target images):
 *     cache-first — they're large and effectively immutable, so there's no
 *     point re-fetching them on every load.
 *   - Cross-origin assets (the buymeacoffee widget on splash, etc.):
 *     stale-while-revalidate. Critically, this means a one-off opaque error
 *     response can't get stuck in cache forever (the old cache-first SW
 *     would serve a broken CDN copy until a hard refresh) — the background
 *     re-fetch overwrites it on the next load.
 *   - Non-GET requests (the shot POST, /api/sync_shots, /recall_arrow):
 *     never intercepted — they always hit the network.
 *
 * Bump VERSION to invalidate every cache on the next activate.
 */
const VERSION = 'apollo-v5';
// One versioned cache. Using a single cache (rather than separate shell +
// runtime caches) means a stale-while-revalidate write always overwrites the
// exact key it was read from — a fresh copy can't be shadowed by an older
// copy living in a different cache.
const CACHE = VERSION;

// Navigations we keep an offline copy of. Deliberately narrow: /sesh is
// the shooting surface (the whole point of offline) and / is the landing
// page. Caching every authenticated page would risk showing stale or
// wrong-user content on a shared device.
const NAV_CACHE_PATHS = new Set(['/sesh', '/']);

const PRECACHE = [
  '/static/style.css',
  '/static/apollo-nav.js',
  '/static/apollo-tags.js',
  '/static/apollo-offline.js',
  '/static/logo.png',
  '/static/icon-192.png',
  '/static/icon-512.png',
  // Self-hosted webfonts (the @font-face sheet + the latin subsets every
  // page actually renders). Precaching these keeps the app's typography
  // correct offline instead of falling back to a system sans-serif.
  '/static/fonts/apollo-fonts.css',
  '/static/fonts/quantico-400-latin.woff2',
  '/static/fonts/quantico-700-latin.woff2',
  '/static/fonts/quantico-400-italic-latin.woff2',
  '/static/fonts/quantico-700-italic-latin.woff2',
  '/static/fonts/bungeeshade-400-latin.woff2',
  '/static/fonts/rubikiso-400-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Only cache responses we can trust: a readable success, or an opaque
// cross-origin response. Opaque responses hide their status, so an opaque
// error can slip through here — that's why opaque assets use SWR, which
// re-fetches every load and overwrites a bad copy.
function cacheable(resp) {
  return resp && (resp.ok || resp.type === 'opaque');
}

// Cache-first: for large, effectively immutable same-origin assets.
function cacheFirst(req) {
  return caches.open(CACHE).then((cache) =>
    cache.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        if (cacheable(resp)) cache.put(req, resp.clone());
        return resp;
      });
    })
  );
}

// Stale-while-revalidate: serve the cached copy immediately, refresh in the
// background. The next load gets the updated asset — no hard refresh — and a
// previously cached-broken response self-heals.
//
// `event.waitUntil(fetching)` is essential: when we answer from cache the
// respondWith promise settles immediately, so without extending the event's
// lifetime the worker could be killed before the background cache.put lands —
// which would quietly defeat the "next load is fresh" guarantee.
function staleWhileRevalidate(event, req) {
  return caches.open(CACHE).then((cache) =>
    cache.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((resp) => {
          if (cacheable(resp)) {
            return cache.put(req, resp.clone()).then(() => resp);
          }
          return resp;
        })
        .catch(() => hit);  // offline: fall back to whatever we had
      event.waitUntil(fetching);
      return hit || fetching;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;   // shot POST / sync / recall pass through
  const url = new URL(req.url);

  // App navigations: network-first so the user gets fresh server truth
  // when online, with the cached shell as the offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok && NAV_CACHE_PATHS.has(url.pathname)) {
            const copy = resp.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/sesh')))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // Same-origin code & styles: stale-while-revalidate so a new deploy's
  // CSS / JS (e.g. the Monte Carlo sim in apollo-predict.js) is picked up on
  // the next load instead of needing a hard refresh.
  if (sameOrigin && /\.(?:css|js)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }

  // Same-origin static images/icons/target images: cache-first (large,
  // immutable — no value in re-fetching every load). Not precached; the first
  // online visit populates the cache so they're available offline afterward.
  if (sameOrigin && url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Cross-origin (the buymeacoffee splash widget, etc.): SWR so a
  // transient CDN error can't get stuck in cache and break the page — the
  // background re-fetch replaces a bad copy on the next load.
  if (!sameOrigin) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }

  // Everything else (dynamic same-origin GET endpoints): default network.
});

// ── Web-push practice reminders ────────────────────────────────────────────
// The server (/cron/reminders) sends a JSON payload {title, body, url}. Show
// it as a notification; clicking it focuses an existing tab or opens the URL.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Apollo';
  const options = {
    body: data.body || '',
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
