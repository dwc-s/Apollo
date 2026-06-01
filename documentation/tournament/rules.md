# Tournament Round Reference

Round-by-round reference for the formats Apollo supports in tournament
mode. Each round entry lists the spec that the route's "tournament
config" object should encode. The internal key (`round_key`) is the
string Apollo uses in URLs and the in-memory `TOURNAMENT_ROUNDS` dict.

Conventions used below:
- Distances in metres or yards as the rule organization publishes them.
- Ring radii in millimetres, measured from the calibrated face center
  to the **outer edge** of each scoring ring (line-cutter convention —
  see `scoring.md`).
- `X = inner-10` ring; for compound on certain rounds the X is the only
  zone scoring the maximum.
- "Arrows / end" is the count shot in one timed end. For multi-spot
  faces, the rule "one arrow per spot" is enforced visually only —
  Apollo records each arrow on whichever spot the user clicks.

---

## World Archery

Source: WA Rulebook (worldarchery.sport/rulebook). Book 2 = Events,
Book 3 = Targets & Equipment, Book 4 = Field & 3D.

### `wa_720_recurve` — WA 720 (Recurve)

| Field | Value |
|---|---|
| Face | **122 cm** 10-zone |
| Distance | **70 m** |
| Arrows / end | **6** (commonly shot 2 × 3) |
| Ends | **12** |
| Total arrows | **72** |
| Max score | **720** |
| End time | **240 s** for 6 (or 120 s × 2 if split) |
| Scoring | Standard 10-zone, line cutter, X = 10 (tracked separately) |

### `wa_720_compound` — WA 720 (Compound)

| Field | Value |
|---|---|
| Face | **80 cm** 6-ring (rings 5–10 only) |
| Distance | **50 m** |
| Arrows / end | **6** |
| Ends | **12** |
| Total arrows | **72** |
| Max score | **720** |
| End time | **240 s** |
| Scoring | 6-ring face: rings 5–10. Line cutter. X = 10. |

### `wa_1440_recurve_m` — WA 1440 (Recurve Men)

Two-day "FITA" round; 36 arrows at each of four distances = 144 arrows,
max 1440. (Recurve women use 70/60/50/30.)

| Distance | Face | End size | Ends |
|---|---|---|---|
| 90 m | 122 cm | 6 | 6 |
| 70 m | 122 cm | 6 | 6 |
| 50 m | 80 cm | 3 | 12 |
| 30 m | 80 cm | 3 | 12 |

End time: 240 s for 6, 120 s for 3.

### `wa_indoor_18m` — WA Indoor 18 m

| Field | Value |
|---|---|
| Face | **40 cm** 10-zone (single-spot) **or** 40 cm vertical 3-spot |
| 3-spot layout | Three reduced faces (rings 6–10), ~20 cm each, stacked vertically |
| Distance | **18 m** |
| Arrows / end | **3** |
| Ends | **20** |
| Total arrows | **60** |
| Max score | **600** |
| End time | **120 s** |
| Compound 10 | **Inner-10 only** counts as 10; outer 10 ring = 9. Recurve: outer + inner 10 both count as 10. |

### `wa_indoor_25m` — WA Indoor 25 m

| Field | Value |
|---|---|
| Face | **60 cm** 10-zone |
| Distance | **25 m** |
| Arrows / end | **3** |
| Ends | **20** |
| Total arrows | **60** |
| Max score | **600** |
| End time | **120 s** |
| Scoring | Standard 10-zone, X tracked, no compound inner-10 distinction (ring is already small) |

### `wa_field_24` — WA Field (Marked Round)

24-target course walk; archer paces themselves target-to-target.

| Field | Value |
|---|---|
| Faces | 80 / 60 / 40 / 20 cm — 6-zone (rings 1–6) |
| Distances | 5 – 60 m (face size correlates with distance) |
| Arrows / target | **3** |
| Targets | **24** |
| Total arrows | **72** |
| Max score | **432** (24 × 18) |
| Compound inner-6 | On 20 cm face, **inner-6 (X)** only counts as 6 for compound; outer 6 = 5 |
| Time | Per-target, ~3 min for a 3-archer group; not enforced |

### `wa_match_recurve` — Olympic / Recurve Set System

| Field | Value |
|---|---|
| Format | **5 sets** × 3 arrows = 15 arrows max |
| Set scoring | Higher per-set total: 2 set points; tie: 1 each; lower: 0 |
| Win condition | First to 6 set points |
| End time | 120 s per set |
| Tiebreak | Single-arrow shoot-off (40 s), closest to center |

### `wa_match_compound` — Compound Match Play

| Field | Value |
|---|---|
| Format | **5 ends** × 3 arrows = 15 arrows total |
| Scoring | Highest cumulative wins |
| Max score | 150 |
| End time | 120 s |
| Tiebreak | Single arrow, closest to center |

---

## NFAA

Source: NFAA Constitution & By-Laws (nfaausa.com/rules). NFAA uses
1–5 scoring on indoor and field rounds, not 1–10.

### `nfaa_indoor_blue` — NFAA Indoor (Single-spot Blue)

| Field | Value |
|---|---|
| Face | **NFAA 40 cm Indoor Blue** face — blue with white scoring rings |
| Rings (radii) | Outer 5 ring = 16 cm outer radius; inner 5 = 8 cm; X = 4 cm |
| Distance | **20 yards** (~18.29 m) |
| Arrows / end | **5** |
| Ends | **12** |
| Total arrows | **60** |
| Max score | **300** |
| Scoring | 5 (with X inside), 4, 3, 2, 1; line cutter; X = 5, tiebreaker |

### `nfaa_indoor_5spot` — NFAA Indoor 5-Spot

| Field | Value |
|---|---|
| Face | **NFAA 5-spot** — 5 small faces (X + 5 ring only) arranged like a "5" on a die |
| Per-spot rings | 5 ring (8 cm outer radius), X ring (4 cm) |
| Distance | **20 yards** |
| Arrows / end | **5** (one per spot; double-hits on a single spot score the lower as M) |
| Ends | **12** |
| Total arrows | **60** |
| Max score | **300** |
| Scoring | 5 or X per arrow; rare for compound to score under 300 |

### `nfaa_vegas_3spot` — Vegas Round (NFAA Vegas Shoot)

| Field | Value |
|---|---|
| Face | **40 cm Vegas 3-spot** — 3 small faces stacked vertically, rings 6–10 |
| Per-spot rings | Same as WA 40cm 6/10 rings; X ring inside the 10 |
| Distance | **20 yards** (18 m at WA-aligned events) |
| Arrows / end | **3** (one per spot) |
| Ends | **10** |
| Total arrows | **30** |
| Max score | **300** |
| Scoring | 10 (with X inside), 9, 8, 7, 6; double-hits on a spot = lower scored M |

### `nfaa_900` — NFAA 900 Round

| Field | Value |
|---|---|
| Face | **122 cm** WA-style 10-zone |
| Distances | **60, 50, 40 yards** — 30 arrows at each |
| Arrows / end | **6** |
| Ends per distance | **5** |
| Total arrows | **90** |
| Max score | **900** |
| Scoring | Standard 10-zone, line cutter |

### `nfaa_field` — NFAA Field Round

| Field | Value |
|---|---|
| Faces | NFAA field faces: **20, 35, 50, 65 cm** with white center, black ring |
| Rings | 5 (X inside), 4, 3 — 3 concentric zones |
| Targets | **28** (or 14 × 2 in a half round) |
| Arrows / target | **4** (one at each of 4 stakes, all at same target) |
| Total arrows | **112** |
| Max score | **560** |
| Scoring | 5/4/3 with X = 5 (tiebreaker); miss = 0 |

### `nfaa_hunter` — NFAA Hunter Round

| Field | Value |
|---|---|
| Faces | All-black face with white center "spot" (4 sizes mirroring Field) |
| Rings | 5 (X inside), 4, 3 |
| Targets | **28** |
| Arrows / target | **4** |
| Total arrows | **112** |
| Max score | **560** |
| Distances | Closer overall than Field; mix of fanned multi-position stakes |

### `nfaa_animal` — NFAA Animal Round

| Field | Value |
|---|---|
| Faces | Animal silhouettes (deer, turkey, etc.), various sizes |
| Zones | Kill zone (high) inside vital zone (low) |
| Format | Shoot until a hit; first-arrow = highest value, then second, then third |
| Scoring | Per-arrow values (e.g. 20/16/12 first; 14/10/6 second; etc.) |

(Animal Round is supported in the documentation as a future enhancement;
the initial release of tournament mode does not enforce its multi-arrow
"shoot until hit" rule — see `scoring.md`.)

---

## USA Archery

Source: USA Archery rulebook (usarchery.org). USAA is the WA member
federation in the USA and adopts WA rules for sanctioned events. The
USAA-specific rounds below diverge from straight WA spec.

### `usaa_indoor_nationals` — USAA Indoor Nationals

Same as `wa_indoor_18m`. 60 arrows on 40cm face at 18 m, 20 ends × 3.

### `usaa_outdoor_nationals_recurve` — USAA Outdoor Nationals (Recurve)

Same as `wa_720_recurve`. 72 arrows at 70 m on 122 cm face.

### `usaa_outdoor_nationals_compound` — USAA Outdoor Nationals (Compound)

Same as `wa_720_compound`. 72 arrows at 50 m on 80 cm 6-ring face.

### `usaa_collegiate_indoor` — USAA Collegiate Indoor

Same as `wa_indoor_18m`.

### `usaa_collegiate_outdoor` — USAA Collegiate Outdoor

Same as `wa_720_recurve` / `wa_720_compound` per equipment class.

### `usaa_joad_indoor` — JOAD Indoor (Junior Olympic Archery Development)

Same as `wa_indoor_18m`; age-class scoring thresholds (Yeoman / Pin /
Star awards) are computed off the score totals — Apollo does not award
pins, but the score is what the JOAD coach compares against the chart.

### `nasp_round` — NASP (National Archery in the Schools Program)

| Field | Value |
|---|---|
| Face | **80 cm** NASP target (10-ring, identical layout to WA 80 cm) |
| Distances | **10 m** and **15 m** |
| Arrows / end | **5** |
| Ends per distance | **3** |
| Total arrows | **30** (15 at 10 m + 15 at 15 m) |
| Max score | **300** |
| Equipment | Standardised Genesis bow; Apollo doesn't enforce bow class |

Note: NASP traditionally used a 122 cm face in some implementations
but the current rule is 80 cm; verify against the NASP Coach's manual.

---

## Format families and their internal structure

Internally, every tournament round above is one of three structural
shapes — see `scoring.md` for the data model:

1. **Single-segment timed round** (one distance, one face, N arrows).
   E.g. WA 720, WA Indoor 18m, NFAA Indoor Blue, Vegas, NASP per-stage.
2. **Multi-segment round** (chained single segments, e.g. 1440 with
   four distance stages, NFAA 900 with three).
3. **Course round** (24 / 28 targets, per-target arrow groups, no fixed
   end clock — pace is target-by-target). WA Field, NFAA Field, Hunter.
