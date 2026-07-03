v0.91 — The archer is given a target to chase, the weather is written down, the string is counted, and the door keeps a ledger

The biggest feature batch since the reports engine: Apollo stops at *measuring*
no longer. Everything here reuses engines that were already in the app — the
handicap fit, the accuracy/precision stats, the classification resolvers, the
shot calendar — and turns them into direction and context. Nothing that existed
was rescored; the migrations only add columns and tables.

**Goals + "am I on track?" (`/goals`).** Set a target with an optional deadline
and Apollo grades it. Handicap and classification goals extrapolate the same
least-squares handicap trend the *Handicap over time* report draws to the
deadline and read out *on-track / behind / achieved*; round-score goals track a
personal best on one round; accuracy (MPI) and precision (R95) goals project
your per-session group stats — as a percentage of target half-width, the same
normalized measure Analyze uses — through the same fit; volume goals pace
arrows-per-week against the shot calendar. The projection helper
(`_project_handicap`) is pure and unit-tested alongside `_handicap_summary`.

**Weather per session + Performance vs conditions.** The session page can pull
temperature, wind, gust and humidity from Open-Meteo (client-side, opt-in — the
same pattern the bow-hand-elevation tool already used, extended with wind) and
store it on the session; you can also type it when editing a session. A new
`/analyze` report buckets your MPI and R95 by wind band and temperature band,
normalized by target size like every other report, so "does wind actually widen
my group?" gets an honest answer instead of a feeling.

**Equipment lifecycle.** Bows now carry a string install date, a shots-at-install
baseline, and a replace-after threshold; arrows carry a set size and in-service
date. The edit pages count shots on the bow, shots on the current string, and
shots on the set, and raise a *service due* badge (surfaced on the dashboard too)
when a string passes its threshold — all counted live from the shot table, no
running counters to drift.

**Records (`/records`).** Personal bests per round, the AGB classification
ladder with the gap to the next rung, every WA Star / USAA pin / AGB class
earned (first-earned dates cached), and practice milestones. Real competitions
are logged through the existing Tournament score-sheet flow (which tags the
session as competed), so they feed the PBs, handicap and classification here
automatically — no separate entry to keep in sync.

**Home dashboard.** Signed in, the splash grew from two stat cards into a
dashboard: streak and days-since-last, handicap, classification, active goals
with their verdicts, and string-service alerts, with quick links out.

**Shareable session card.** The end-of-session screen draws a branded PNG of the
result on a `<canvas>` and offers it through the Web Share API (or a download) —
entirely client-side, nothing stored.

**Practice reminders (PWA web-push).** Opt in on `/account`; the service worker
gained push and notification-click handlers. `/cron/reminders`, guarded by
`CRON_SECRET` and meant for a daily external scheduler, pushes anyone who has
gone quiet past their idle threshold, once per lapse, and prunes dead
subscriptions. It degrades gracefully — no VAPID keys or no `pywebpush` and it
logs instead of sending, so it can never crash a request.

How it was checked: the projection, conditions-bucketing, lifecycle-counter,
achievement, dashboard, card and reminder logic were each exercised against a
copy of the real database; the migrations were confirmed to fire once and be a
no-op on the second boot; the pages were driven live in the browser (goals,
records, dashboard, the equipment badges, the endpoints); the session card was
rendered and its PNG inspected; the reminder cron was run through its guard,
send, and de-nag paths. `pytest` stays green — 39 existing tests plus 9 new ones
for the projection and wind bands.
