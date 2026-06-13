v0.64 — No more hard refreshes, no more CDNs

Two long-standing annoyances turned out to share a single culprit, and fixing
it properly meant cutting the app's last ties to third-party CDNs. The service
worker had been serving every asset cache-first under a version string that
never changed, so a new deploy's styling and scripts stayed shadowed by stale
copies until a manual hard refresh — and a one-off CDN hiccup could wedge a
broken library in cache forever. This release rewrites the caching strategy and
self-hosts everything the app loads, so the page you get is always the page we
shipped.

- **Fonts no longer vanish on navigation; the Monte Carlo sim no longer needs
  a hard refresh.** The service worker now serves CSS and JS
  stale-while-revalidate: the cached copy renders instantly, but a fresh copy
  is fetched in the background every load and picked up on the next visit — no
  hard refresh. Large images stay cache-first. The cache is now a single
  versioned store that's fully purged when the version bumps, and a
  `waitUntil` on the background revalidation guarantees the refreshed copy
  actually lands before the worker can be shut down.

- **Webfonts are self-hosted.** Quantico, Bungee Shade and Rubik Iso are
  served from `/static/fonts` with a local `@font-face` sheet instead of
  Google Fonts. The intermittent "lost styling on navigation" was the
  cross-origin font fetch failing; same-origin fonts don't have that failure
  mode, and they work offline. The latin subsets are precached so typography
  is correct even on the first offline load.

- **The analyze chart lightbox is self-hosted and reliable.** lightGallery
  (plus its zoom/thumbnail plugins, CSS and icon font) now lives under
  `/static/vendor`. Clicking a report chart opens it in the same tab as a
  full-screen, 100%-width SVG — the intended behavior, with no dependency on a
  CDN that could fail to load and silently leave the thumbnails dead.

- **The dead Plotly dependency is gone.** The interactive time-slider heatmap
  was removed from the backend a few releases ago, but `analyze.html` still
  pulled in ~3.5 MB of Plotly on every visit to render nothing. The shot
  density heatmap has always been a server-rendered matplotlib hexbin SVG, so
  nothing visual changed — the page is just that much lighter.

- **Chart.js is self-hosted.** The predict-performance charts load Chart.js
  from `/static/vendor` instead of jsdelivr.

- **Tighter Content-Security-Policy.** With fonts, lightGallery and Chart.js
  all same-origin, `fonts.googleapis.com`, `fonts.gstatic.com` and
  `cdn.jsdelivr.net` are dropped from the policy. The only remaining
  third-party origin is the optional Buy-Me-a-Coffee widget on the splash
  page.

No schema changes. New vendored static assets (fonts, lightGallery, Chart.js);
no new Python runtime dependencies.
