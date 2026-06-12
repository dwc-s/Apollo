v0.62 — Handicaps & classifications

A raw score answers "how did I shoot today" but not "how does that compare to
last month, to a different round, or to where I want to be." Archers track
that with two universal currencies Apollo didn't surface: a **handicap** (a
single Archery GB precision number, comparable across rounds and distances —
lower is better) and **classifications** (named achievement tiers a score
earns). This release computes both for every completed tournament round and
shows them on the round-complete banner, the sessions history, and every
scorecard export.

- **AGB 2023 handicap engine.** New dependency-free `handicap.py` implements
  the official Archery GB 2023 formula (angular deviation
  `5e-4·1.035^(H+6)·e^(0.00365·d)`, a Rayleigh expected-score per arrow, and
  the integer score→handicap inversion with the scheme's round-up rule). It's
  fed by Apollo's existing target-face ring geometry and round segments, so
  there's no second source of truth for faces, and it works on any concentric
  WA/USAA face. The handicap deliberately uses the scheme-standard arrow
  diameter (5.5 mm outdoor, 9.3 mm indoor) so the number matches published
  AGB tables and is comparable between archers — the raw score it's looked up
  from is still Apollo's real-arrow, line-cutter score. Validated against the
  MIT-licensed `archeryutils` reference (matches its `sigma_t(10, 25)` and its
  `handicap_from_score(999, WA1440-90) = 44`).

- **Classifications for three schemes.** New `classifications.py` +
  `handicap_data.py` resolve, per completed round and the archer's category:
  **Archery GB** target classifications (Archer → Bowman → Master Bowman
  tiers, indoor and outdoor, thresholds derived by the published
  datum/step formula), **World Archery** Star Awards (white→purple on the
  1440), and **USA Archery** World Archery Performance Award pins (1000–1300
  on the 1440). The Master Bowman tier is flagged as record-status-only for
  information rather than enforced. Classifications are informational per
  round — no season tracking, event-status rules, or annual reassessment.

- **Archer profile.** New nullable columns (`users.gender`, `users.age_group`,
  `users.default_bowstyle`, `bows.bowstyle`), added by an additive,
  SQLite/MySQL-safe startup migration. A new "Archer profile" panel on the
  account page sets the category; a per-round **bowstyle override** at round
  start (carried on each shot's `session_tags` as `bowstyle:<style>`) lets you
  shoot a different style for one round without changing your default.
  Handicaps need none of this; classifications use it to pick the right table.

- **Surfaced everywhere a result is.** The tournament round-complete banner
  shows the handicap and any earned classification/star badges; the previous-
  sessions list adds a handicap chip and class badges per completed
  tournament round; and the CSV, Excel, PDF, and emailed scorecards all carry
  the handicap and classification lines.

Handicaps and classifications are computed for **every** completed eligible
round you log — practice or competition — matching how an AGB handicap is
actually built (any round counts). **NFAA** classification is intentionally
left for a later release: it's a relative, multi-score handicap rather than a
single-round lookup, so it doesn't fit this per-round model.

No new runtime dependencies. New `tests/` directory (a first for the repo)
with unit tests for the handicap math and classification boundaries, plus an
end-to-end check that drives the real Flask stack.
