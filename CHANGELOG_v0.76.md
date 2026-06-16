v0.76 — The bow keeps its bones, the line keeps the dials

A bow has a few things that are truly *it* — its name, its kind, how heavy it
draws, how long it is. Everything else an archer fiddles with — sight marks,
plunger tension, finger tab, riser weights, what the arrow rests on — changes
from one outing to the next. This release sorts the two: Add/Edit bow now holds
only the bow's permanent identity, and all the tunable gear moves to the
session and tournament screens where it's actually adjusted. The one trait that
*is* the bow's but lived on the session — effective draw weight — moves the
other way, onto the bow.

- **Add/Edit bow, pared to the essentials.** A bow definition is now just name,
  type, draw weight, **effective draw weight** and length (AMO). The bowtype
  gear block is gone from these forms — there's nothing to tune on a bow that
  isn't tuned at the line.

- **Effective draw weight is a property of the bow.** It's an archer's actual
  draw weight, which barely shifts as long as their draw length holds, so it's
  entered once per bow and snapshotted onto every shot from the bow row — the
  same way rated draw weight and AMO already were. The per-session field is gone
  from the live session, tournament round, practice scorecard, match cards and
  the session editor.

- **All gear lives in the session.** The "Bow-specific gear & tuning" collapsible
  on the session and tournament screens now carries the full kit — aiming
  method, finger protection, riser weights, sight type, stabilizer and the rest
  — every field tuned per outing and remembered per bow from your last shot.

- **Nock height retired.** It was neither a fixed property of the bow nor a
  meaningful per-outing dial, so it's been removed from the forms and the shot
  record entirely.

- **Smaller gear fixes.** Trad arrow material is no longer asked twice — it's
  inherited from the arrow you pick (set when the arrow was added). "Shot off"
  now offers **arrow rest** alongside shelf and hand, and appears for barebow.

- **Layout & type.** The arrow selector now sits directly under the bow selector
  on the session and tournament forms, with the gear menu below both. Two
  Quantico-font regressions are fixed: the match-play archer-setup intro and the
  "Bow-specific gear & tuning" summary now render in the app's typeface.

- **Clearer bowstyle names.** "Recurve" now reads **Olympic recurve** and
  "Barebow" reads **Barebow recurve** everywhere they're shown — dropdowns, the
  edit-bow label, account default and the spine/speed tools. Stored values are
  unchanged.

Internally: every field in `BOWSTYLE_SETTINGS` is now `scope: 'dynamic'`; the
bow forms write no `style_settings`, and a bow's last-used gear is recovered
from its most recent shot via `_style_settings_by_bow()` rather than a static
blob (legacy blobs are still read as a prefill base). `_insert_shot` and the
tournament/edit-session snapshot paths read `effective_draw_weight` from the bow
row; the `effective_dw_session` parameter and the `_last_effective_dw_by_bow` /
`_current_session_effective_dw` helpers are gone. Display labels come from a new
`BOWSTYLE_LABELS` map exposed as a `bowstyle_label` Jinja filter. The dormant
`bows.nock_height` / `apollo.nock_height` columns are left in place to preserve
historical data. No new dependencies; no destructive migration — existing bows
keep their data, and shots taken before a bow's effective draw weight is set
fall back to its rated weight in analysis, as they always have.
