/* Apollo service worker — PWA shell + offline support.
 *
 * Goals:
 *   1. Make the app installable and openable without a connection.
 *   2. Keep the /sesh shooting screen renderable offline so the
 *      offline shot queue (apollo-offline.js) has a UI to draw into.
 *
 * Strategy:
 *   - App shell (CSS/JS/icons): precached on install, served cache-first.
 *   - Navigations (/sesh, /): network-first, falling back to the last
 *     cached copy so the target screen still opens with no signal.
 *   - Other same-origin /static assets (incl. target images under
 *     /static/targets/): cache-first, populated lazily the first time
 *     they're fetched online.
 *   - Cross-origin assets (Google Fonts): cache-first, best effort.
 *   - Non-GET requests (the shot POST, /api/sync_shots, /recall_arrow):
 *     never intercepted — they always hit the network.
 *
 * Bump VERSION to invalidate every cache on the next activate.
 */
const VERSION = 'apollo-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

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
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(req) {
  return caches.match(req).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((resp) => {
      // Only cache successful, basic/cors responses; opaque (cross-origin
      // font) responses are cached too — they're safe and immutable.
      if (resp && (resp.ok || resp.type === 'opaque')) {
        const copy = resp.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy));
      }
      return resp;
    }).catch(() => hit);  // undefined on a true miss → network error surfaces
  });
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
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/sesh')))
    );
    return;
  }

  // Same-origin static assets (incl. the session's target image).
  if (url.origin === self.location.origin && url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Cross-origin (fonts.googleapis.com / fonts.gstatic.com).
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else (dynamic GET endpoints, etc.): default network.
});
