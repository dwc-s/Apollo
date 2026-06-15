v0.74 — Only the dials that fit the bow

v0.71 gave each bow its own gear fields; this release sharpens the edges. An
Olympic recurve and a barebow are both recurves at heart, but the kit pulls them
apart: the Olympic archer aims through a sight and balances on a stabilizer rig,
while the barebow archer is forbidden both and crawls the string instead. Apollo
now reflects that split properly — and tidies the screens those fields live on.

- **The recurve gets its sight.** Olympic recurve was missing its single most
  defining piece of kit. It now carries a **Sight type** (aperture,
  aperture+clarifier, fiber-optic) and a per-distance **Sight aperture (mm)**,
  plus a **Long-rod length** to go with the stabilizer choice. Barebow keeps its
  own world — aiming method, riser weights, string crawl — and, correctly, shows
  no sight, clicker or stabilizer at all. The two are no longer near-duplicates.

- **Gear folds away.** The bowtype-specific options on the session and
  tournament forms now live in a collapsible "Bow-specific gear & tuning" panel,
  collapsed by default. The clutter is gone until you want it; the fields still
  submit (and still prefill to their last-used values) whether the panel is open
  or shut.

- **Arrows-left, under the target where your eyes already are.** The remaining
  arrow count moved out of the right-hand form column and into the readout bar
  beneath the target, sitting to the right of the coordinate / "missed target"
  text with a divider between them — on both the session and tournament screens.
  One less place to look mid-end.

- **A tournament shoots rounds, not sessions.** Wording on the tournament screens
  now says *round* throughout — the practice scorecard's "Round name", the recall
  tooltip, and the noteworthy-anything prompts.

- **The end screen knows what you just finished.** Ending an outing now reads
  **End Match**, **End Round**, or **End Session** to match its context — a match,
  a tournament round, or a standalone session — and the results banner echoes it
  ("Match ended" / "Round ended" / "Session ended"). Consistent with the
  breadcrumb that already distinguished a match from a round.

Internally: the whole gear split is still driven by the one `BOWSTYLE_SETTINGS`
dict — three fields added to `recurve`, nothing else touched — so the add/edit-bow
forms (static fields), session/tournament forms, validation, and the /analyze
head-to-head report all pick it up unchanged; `sight_type` was already a
comparison dimension. The collapsible is one shared include
(`_bow_style_settings.html`) wrapped in a `<details>`, covering both routes at
once. The end-screen wording comes from a small `_end_session_noun()` helper read
before the per-round session keys are cleared on finalize. No schema changes, no
new dependencies.
