v0.61 — Offline shot capture & installable PWA

Apollo is used at the range, where signal is often poor — yet every tap on
the target was a synchronous POST that the server answered with a full page
re-render. Drop the connection and the shot was lost. This release makes
Apollo an installable Progressive Web App that captures shots locally when
offline and syncs them when the connection returns, so a range trip with no
signal is saved as if the network had been there the whole time.

- **Installable PWA shell.** New `static/manifest.webmanifest` (with
  generated 192/512/maskable icons derived from the logo) plus a service
  worker (`static/sw.js`) make Apollo addable to the phone home screen and
  openable without a connection. The worker precaches the app shell, serves
  navigations network-first (so `/sesh` falls back to its cached copy
  offline) and static assets cache-first, and never intercepts POSTs. It's
  served from `/sw.js` (a new Flask route) rather than `/static/` so its
  scope covers `/sesh`; `/manifest.webmanifest` is served from the root too.
  Registration + manifest links were added to the session, splash, and login
  pages so the app is installable from any entry point.

- **Offline shot capture (`static/apollo-offline.js`).** When
  `navigator.onLine` is false, a tap on the target is saved to an IndexedDB
  queue instead of POSTed, and the quiver state machine runs client-side —
  mirroring the server exactly: arrows-remaining decrements, the quiver-size
  input locks mid-quiver, and completing a quiver bumps "quivers completed"
  and clears the canvas for the next. Markers draw through the page's
  existing `drawPastShots()` renderer, and a banner shows "Offline — N shots
  saved on device." All five existing submit paths (tap, press-and-hold
  release, confirm, miss, quiver-size modal) funnel through the one
  `form.submit` override, so nothing new had to be wired into each handler.

- **Offline recall.** The Recall button undoes the most recent *queued*
  shot locally (no network), correctly reversing the state machine —
  including the case where the recalled shot had just closed a quiver.

- **Batch sync on reconnect (`POST /api/sync_shots`).** Returning online
  POSTs the whole queue as JSON in one request (CSRF via the `X-CSRFToken`
  header, no exemption) and clears it on success. Each shot keeps its **real
  on-device timestamp**, so synced arrows land at the time they were actually
  shot, not at sync time. The endpoint validates that every referenced
  session belongs to the user and rejects an unknown session as a unit
  rather than silently dropping shots.

- **Cookie reconciliation.** The live `/sesh` path tracks quiver counters in
  the Flask session cookie, not the posted form — so after offline shots land
  the cookie would be stale, and the next *online* shot could re-use a
  counter. The client reports its final counters with the batch and the sync
  endpoint adopts them (only when they belong to the still-active session), so
  shooting can continue online immediately after a sync with no corruption.

- **Shared insert helper (refactor, behavior-neutral online).** The per-shot
  equipment-snapshot + INSERT block was factored out of the `/sesh` POST into
  a single `_insert_shot()` helper now used by both the live path and the
  sync endpoint, so a synced shot is byte-for-byte equivalent to a live one
  (same bow/arrow snapshotting) apart from its timestamp.

- **Scope (v1) and guards.** Offline capture covers ordinary practice
  sessions that were *started online* (so a `session_id` exists). Tournament
  and live-match sessions still require a connection — an `is_tournament`
  flag on the page makes the client refuse to queue and prompt to reconnect.
  Documented follow-ups: fully-offline cold start, per-shot dedupe keys,
  tournament offline support, and Background Sync.

- **Verification.** Exercised end to end against a running server and a real
  browser: PWA endpoints and service-worker control; offline capture across a
  quiver boundary; offline recall (including the quiver-completion case);
  sync on reconnect draining the queue; rows landing in the DB with their real
  offline timestamps; and a post-sync online shot continuing the counter
  sequence without duplication.
