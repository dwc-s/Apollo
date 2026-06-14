v0.71 — Each bow, its own dials

Until now Apollo treated every bow the same: model, draw weight, length, nock
height — the handful of fields shared by a longbow and a compound alike. But a
compound has a release aid, a let-off, a peep and a scope; an Olympic recurve
has a clicker, a plunger, a stabilizer rig and a tab; a barebow has an aiming
method and a string crawl that changes with distance. None of it was capturable,
so none of it was analysable. This release makes the form follow the bow: pick a
bow type and the options that belong to it appear.

- **Bowtype-specific settings, on the bow and in the session.** Gear splits into
  two tiers. *Static* gear — a property of the bow that rarely changes (compound
  release aid / let-off / peep / scope, recurve clicker / stabilizer / tab,
  barebow aiming method / riser weights) — is set once on Add bow and Edit bows.
  *Dynamic* tuning that you tweak between outings — string crawl, brace height,
  plunger tension — is chosen per session. The session and tournament forms show
  both, prefilled to their last-used values, and snapshot them onto every arrow.

- **The form follows the bow type.** Selecting a bow reveals exactly its style's
  fields and hides the rest — no compound peep size cluttering a longbow, no
  longbow shelf option on a recurve. Add bow now offers all six bowstyles
  (barebow, traditional and flatbow join the original three), each with its own
  field set.

- **Settings persist like effective draw weight.** Override a value at session
  start and it sticks for the rest of the session, repopulating shot to shot
  rather than snapping back to the bow's default — the same behaviour the
  effective-draw-weight field has always had.

- **Compare by gear on /analyze.** The head-to-head report gains new comparison
  dimensions drawn from the settings: line up index vs thumb-trigger releases,
  string-walking vs gap aiming, tab vs glove, single-pin vs movable sights — and
  see whether the choice actually moved your group. The same Mann-Whitney U /
  Brown-Forsythe / Hotelling's T² tests apply, normalised across target sizes.

Each shot now carries a JSON snapshot of the gear in force when it was loosed,
so later edits to a bow never rewrite a past shot's attribution — the same
self-describing rule the bow and arrow snapshot columns already follow. The
whole feature is driven by one schema dict (`BOWSTYLE_SETTINGS`): templates
render from it, the POST handlers validate against it, and the report buckets by
it. Two nullable columns added by an idempotent migration (`bows.style_settings`,
`apollo.bow_style_settings`); export and import round-trip them for free. No new
dependencies.
