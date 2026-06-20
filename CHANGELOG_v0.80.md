v0.80 — The arrow logged without turning the page, asked twice but counted once

Recording a shot used to reload the whole session screen. Each arrow was a
full-page POST that re-rendered ~58 KB of HTML — and on iPad that navigation
could be lost on a recycled connection, leaving you on a 502 that only a manual
refresh (sometimes several) would clear. This release records each shot in the
background instead, updating the target and counters in place, and makes a
dropped response safe to retry.

- **Shots record without a page reload.** Placing an arrow (tap, press-and-hold
  release, confirm, or miss) now POSTs to a new `/api/record_shot` endpoint with
  `fetch` and updates the page in place — arrows-left, quivers-completed, the
  quiver-size lock, the target lock, and the past-shot dots. No navigation, no
  full re-render, far less to send over the wire.

- **A lost response is retried — and can't double-count.** On a network or
  gateway (5xx) failure the client retries with backoff; if every attempt fails
  it keeps your placed arrow and offers a Retry button rather than stranding you
  on an error page. Each placed shot carries a `client_uuid`, so a retry of a
  shot the server already saved (its reply lost in transit) is recognised as the
  same shot and folded into a success — never recorded or counted twice.

- **The full-page path still works.** The native form POST to /sesh remains the
  no-JS fallback, and the offline shot queue (apollo-offline.js) is unchanged.

Under the floor: a new nullable `client_uuid` column on `apollo` with a
`UNIQUE(user_id, client_uuid)` index (idempotent migration; NULLs — full-page
and offline-synced shots — coexist freely on both SQLite and MySQL). The shot
state machine (validate → insert → advance the quiver counters) is extracted
into a single `_apply_shot` shared by the full-page POST and the AJAX endpoint,
so the two can't drift; on an idempotent retry the session counters are
re-derived from the database rather than a possibly-stale cookie.

Tests: 29 pytest green; the new endpoint verified end-to-end through the real
Flask stack (insert, idempotent retry → one row not two, quiver lock/close,
mid-quiver rejection, the migration) and the in-place update + idempotency
confirmed in a real browser.
