# Apollo Internal Scoring Procedures

How Apollo tournament mode classifies and tallies shots. The base
mechanism reuses Apollo's existing `target_zones` machinery; what's
new in tournament mode is the **enforcement layer** that locks the
end size, face, scoring rule, and total-arrow count to the chosen
round.

> For the precise formulas behind scoring and the `/analyze` statistics,
> see [FORMULAS.md](../FORMULAS.md).

## Coordinate system

Every shot is stored as `(x_coord, y_coord)` in **physical millimetres
from the calibrated target center**. +X is right, +Y is up. The
sentinel `(100000, 100000)` marks a miss. This is the same system the
`/sesh` route uses; tournament mode does **not** introduce a new
coordinate convention.

## Line-cutter rule

Apollo implements the World Archery / NFAA / USAA line-cutter convention:

> If any portion of the arrow shaft touches the dividing line between
> two scoring zones, the arrow scores the higher value of the two.

This is implemented in `_classify_shot()` in `apollo.py`:

```python
shaft_radius = _parse_shaft_diameter_mm(shaft_diameter_mm) / 2.0
dist = math.sqrt(x*x + y*y) - shaft_radius
if dist < 0:
    dist = 0.0
for i, z in enumerate(zones):  # innermost-out
    if dist <= float(z['radius_mm']):
        return i
return None  # out of all zones — scores 0
```

The shaft diameter comes from the arrow row when present; the fallback
is `DEFAULT_SHAFT_DIAMETER_MM` (6 mm) — a reasonable mid-weight target
shaft. The Precision-mode cursor on the session page renders a circle
of the same radius so the archer sees what the scoring code will see.

## Zone definitions per round

Each round in `TOURNAMENT_ROUNDS` references a **face key** (e.g.
`wa_122`) that maps to a target row in the `targets` table plus a
list of `target_zones` rows. On first visit to `/tournament`, Apollo
seeds any missing tournament faces for the current user — same
mechanism as `_seed_user_default_target()`. The seeded zones use the
official WA / NFAA ring radii so the line-cutter calculation produces
the published score automatically. Tournament face rows are named
with the ASCII prefix `[Tournament] ` so the seeder can find them
deterministically and the user sees a distinct group in the targets
dropdown. (Earlier builds used a 🏆 emoji prefix; the seeder
auto-renames any leftover rows on first run so the rename is
transparent.)

Ring radii are stored in mm; faces are stored at their physical
diameter (e.g. 122 cm = 1220 mm). The image scale (`image_size_px`)
matches the bundled image file — see `targets.md` for which file is
used for each face.

### Inner-10 (X-ring) handling

Two scoring modes are encoded:

- **Standard** (recurve, all 1440 and outdoor): inner-10 and outer-10
  both score 10. The X is tracked **separately** for tiebreakers (count
  of Xs, then count of 10s) — see "Round totals" below.
- **Compound-inner-10** (compound on WA Indoor 18m, NFAA Vegas 3-spot):
  the inner-10 ring is the only zone scoring 10. The "outer 10" scores
  9. Implemented by inserting an additional zone row whose
  `point_value=9` covers the band between the X-ring radius and the
  classic-10 radius, with the X-ring (`point_value=10`) inside it.

The scoring rule for a round is captured by `scoring_rule` in the
round config: `wa_10_zone`, `wa_10_zone_compound`, `wa_6_zone`,
`wa_6_zone_compound`, `nfaa_5_ring`, `nfaa_5_ring_5spot`,
`nfaa_3_ring_field`. The rule string selects which set of zone rows
to seed for that face.

## End size enforcement

The existing `/sesh` route uses a "quiver size" lock: once the first
arrow of a quiver fires, the size cannot change until the quiver
completes. Tournament mode reuses that machinery but **fixes the
quiver size to the round's `arrows_per_end`** — the input is rendered
read-only and the server rejects any POST with a different value (HTTP
400). This is what makes the score totals reproducible: every end has
exactly `arrows_per_end` arrows, so end indexes line up with the
official scorecard.

## Round completion

A tournament session is "complete" when total arrows shot ==
`round.total_arrows`. The handler tracks this client-side
(`arrows_shot_count`) and server-side (`COUNT(*)` on the `apollo`
table filtered by `(user_id, session_id)`). When the count reaches
the limit:

1. The shot form disables further submissions and shows a
   "Round complete" banner.
2. The "End round" button appears, routing to `/end_session` which
   finalizes timestamps and shows the existing end-of-session stats
   plus a tournament-specific summary block.

The user can still end the round early via the regular End-session
link; the summary just shows partial progress with `arrows_shot /
total_arrows` and the partial score.

## Round totals

For every completed tournament session, Apollo computes:

- **Total score** — sum of `_score_one_shot()` over every arrow in the
  session.
- **X count** — count of arrows whose `dist - shaft_radius` falls
  inside the X-ring radius for that face. The X-ring radius is
  encoded per-face in `TOURNAMENT_FACES`; on faces with no X ring
  (NFAA 5-spot uses 5/X like Vegas) the count is the number of arrows
  in the innermost zone.
- **10 count** — analogous, for the 10 ring (or 5 ring on NFAA indoor
  rounds — the max-value ring).
- **Arrows shot / arrows planned** — `shots_in_session / round.total_arrows`.
- **End table** — per-end array of `[arrow_scores..., end_total,
  running_total]` for display.

These are computed on the fly from the `apollo` table on every
`/tournament` GET — no separate `tournament_scores` table. Storage
of "is this a tournament round" lives in `session_tags` (the round
key is added as a tag prefixed `tournament:`, e.g.
`tournament:wa_720_recurve`), so a tournament session survives
through the existing previous-sessions list and analytics without
needing a schema migration. The single source of truth for which
round a session was is its tag.

## Time limits

Apollo does **not** auto-stop ends at the timed limit. The session
page displays the round's time-per-end so the user can use their
own clock or a club timer. Adding a soft countdown is a future
enhancement — the route surfaces the limit in seconds in the round
config so the UI can render a timer ring when it's ready.

## Distance enforcement

Tournament rounds with multiple distances (1440, NFAA 900, course rounds)
prompt the user to confirm distance at the start of each new segment.
Apollo stores the round's currently-active segment in the Flask
session cookie under `tournament_segment_idx`; advancing happens when
the segment's arrow count is hit. The distance field on the shot row
records what the user confirmed for that arrow's segment.

## Equipment class

The round config carries an `equipment_class` hint (`recurve`,
`compound`, `barebow`, `any`) which controls:

- which target face is shown (e.g. compound on WA outdoor → 80 cm
  6-ring at 50 m)
- which scoring rule applies (compound-inner-10 on 18 m)

The user's actual bow choice comes from the existing bows table —
Apollo does not enforce that the selected bow's `bow_type` matches
the round's `equipment_class`. A warning is shown if it doesn't.

## Live match play (multi-archer)

Match-play rounds (`wa_match_*`) can be run as a **live match** on one
shared device — 2 to 4 archers taking turns at the canvas. The routes
are `/tournament/match` (setup form, collects archer names + emails) and
`/tournament/match/start`:

- **One session per archer.** `tournament_match_start` mints a separate
  `session_id` for each archer (all owned by the device owner), tags them
  with a shared match id, and stores the roster + an active-archer
  pointer in the Flask session cookie.
- **Turn taking.** The active archer's `session_id` is mirrored into
  `session['session_id']` so the normal single-archer `/tournament`
  render path is reused unchanged; the POST handler swaps the active
  archer at each completed end (AB-CD detail order).
- **Scoring per round system.** Each archer keeps a separate scorecard.
  For **cumulative** rounds the higher running total wins; for the
  **set system** (`wa_match_recurve_set`), `_match_set_scoring` awards 2
  set points to the higher end total (1 each on a tie), first to 6 set
  points wins, and a 5–5 tie is flagged for a single-arrow shoot-off
  (WA 12.1.4.1).

## What Apollo's tournament mode does NOT do

By design, tournament mode is a personal-tracking layer over /sesh —
not a sanctioned-event tool. It deliberately leaves out:

- Official judges / arrow-witnessing protocols (rebound arrows,
  hangers, bouncers).
- Team-round shooting orders (AB-BA-AB alternating team shots).
- Automated end-clocks and audible signals.
- Automated tiebreak shoot-off arrows (a 5–5 set tie is *flagged*, but
  the deciding arrow is shot and entered manually; Apollo also shows the
  X count and inner-10 count needed to break a tie by hand).
