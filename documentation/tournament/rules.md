# Tournament Round Reference

Round-by-round reference for the formats Apollo supports in
tournament mode. Each round entry below lists the spec that the
route's `TOURNAMENT_ROUNDS` dict encodes. The internal `round_key`
is the string Apollo uses in URLs and tags.

Conventions:
- Distances given in the unit the rule organization publishes them in
  (m for WA / USAA, yd for NFAA). Apollo stores all shot distances in
  metres; yards are converted at the round definition.
- "Arrows / end" is the count shot in one timed end. For multi-spot
  faces, the rule "one arrow per spot" is documented for the user
  and not enforced — Apollo records each arrow on whichever spot
  the user clicks.
- Ring radii are not repeated here; see `targets.md`.

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
| End time | **240 s** |
| Scoring | Standard 10-zone, line cutter, X tracked separately |

### `wa_720_compound` — WA 720 (Compound)

| Field | Value |
|---|---|
| Face | **80 cm** 6-ring |
| Distance | **50 m** |
| Arrows / end | **6** |
| Ends | **12** |
| Total arrows | **72** |
| Max score | **720** |
| End time | **240 s** |
| Scoring | 6-ring face: rings 5–10. Line cutter. X tracked. |

### `wa_1440_recurve_m` / `wa_1440_recurve_w` — WA 1440 (Recurve)

Two-day "FITA" round, 144 arrows, max 1440. Men shoot 90/70/50/30 m;
women shoot 70/60/50/30 m. Compound variants use the 80 cm 6-ring
face at the short distances.

| Distance | Face | End size | Ends |
|---|---|---|---|
| Long 1 | 122 cm | 6 | 6 |
| Long 2 | 122 cm | 6 | 6 |
| 50 m | 80 cm (10-zone for recurve / 6-ring for compound) | 3 | 12 |
| 30 m | 80 cm | 3 | 12 |

Round keys: `wa_1440_recurve_m`, `wa_1440_recurve_w`,
`wa_1440_compound_m`, `wa_1440_compound_w`.

### `wa_indoor_18_recurve` / `wa_indoor_18_compound` — WA Indoor 18 m

| Field | Value |
|---|---|
| Face | **40 cm** 10-zone |
| Distance | **18 m** |
| Arrows / end | **3** |
| Ends | **20** |
| Total arrows | **60** |
| Max score | **600** |
| End time | **120 s** |
| Compound | Inner-10 (X) only scores 10; outer 10 ring scores 9 |

### `wa_indoor_25` — WA Indoor 25 m

60 arrows on the 60 cm face at 25 m. Standard 10-zone scoring; no
compound inner-10 distinction (the ring is already narrow).

### `wa_field_24` — WA Field (24-target marked round)

24-target course, 3 arrows per target, max 432. Six targets at each
of the four WA Field face sizes (80 / 60 / 40 / 20 cm) at canonical
marked distances.

### `wa_match_recurve_cum` — WA Match Play — Recurve (cumulative)

5 ends × 3 arrows at 70 m on the 122 cm face. Cumulative scoring,
max 150.

### `wa_match_recurve_set` — WA Match Play — Recurve (set system)

5 sets × 3 arrows at 70 m on the 122 cm face. Per set the higher
total earns 2 set points (1 each on a tie). First to 6 set points
wins; tie at 5–5 → single-arrow shoot-off. Apollo records per-set
totals; the user compares against an opponent's scorecard manually.

### `wa_match_compound` — WA Match Play — Compound

5 ends × 3 arrows at 50 m on the 80 cm 6-ring face. Cumulative
scoring, max 150.

---

## NFAA

Source: NFAA Constitution & By-Laws (nfaausa.com/rules), 2026/27
edition. NFAA uses 1–5 scoring on indoor and field rounds.

### `nfaa_indoor_blue` — NFAA Indoor (Single-spot Blue)

| Field | Value |
|---|---|
| Face | **NFAA 40 cm Indoor Blue** face |
| Distance | **20 yards** (~18.29 m) |
| Arrows / end | **5** |
| Ends | **12** |
| Total arrows | **60** |
| Max score | **300** |
| Scoring | 5 (with X inside), 4, 3, 2, 1; line cutter; X = 5, tiebreaker |

### `nfaa_5spot` — NFAA Indoor 5-Spot

| Field | Value |
|---|---|
| Face | **NFAA 5-spot** — 5 small faces with X + 5 ring only |
| Distance | **20 yards** |
| Arrows / end | **5** (one per spot) |
| Ends | **12** |
| Total arrows | **60** |
| Max score | **300** |

### `nfaa_vegas` — Vegas Round (NFAA Vegas Shoot)

| Field | Value |
|---|---|
| Face | **40 cm Vegas 3-spot** — 3 faces stacked vertically, rings 6–10 |
| Distance | **20 yards** (18 m at WA-aligned events) |
| Arrows / end | **3** (one per spot) |
| Ends | **10** |
| Total arrows | **30** |
| Max score | **300** |

### `nfaa_900` — NFAA 900 Round

122 cm face at 60 / 50 / 40 yards, 30 arrows at each, total 90,
max 900. 6 arrows per end, 5 ends per distance.

### `nfaa_field_28` — NFAA Field Round (28 targets)

28-target field course; 4 arrows per target; 65 / 50 / 35 / 20 cm
NFAA field faces (white center). Total 112 arrows, max 560. Adult
canonical distance schedule encoded in `_NFAA_FIELD_28_SCHEDULE_YD`.

### `nfaa_hunter_28` — NFAA Hunter Round (28 targets)

Same arrow count and face sizes as Field; hunter face style
(black face, white spot). Closer distances overall per the
hunter-round schedule.

(NFAA Animal Round is omitted — its shoot-until-hit walk-up format
doesn't fit Apollo's per-shot recording model.)

---

## USA Archery (USAA)

USAA adopts WA rules for sanctioned events; the rounds below mirror
the corresponding WA round structurally but carry USAA-branded
names so they land in the USA Archery section of the selector.

| Round key | Equivalent of |
|---|---|
| `usaa_indoor_nationals` | `wa_indoor_18_recurve` |
| `usaa_outdoor_nationals_recurve` | `wa_720_recurve` |
| `usaa_outdoor_nationals_compound` | `wa_720_compound` |
| `usaa_collegiate_indoor` | `wa_indoor_18_recurve` |
| `usaa_collegiate_outdoor_recurve` | `wa_720_recurve` |
| `usaa_collegiate_outdoor_compound` | `wa_720_compound` |
| `usaa_joad_indoor` | `wa_indoor_18_recurve` |

---

## Format families

Internally, every tournament round above is one of three structural
shapes — see `scoring.md` for the data model:

1. **Single-segment timed round** (one distance, one face, N arrows).
   E.g. WA 720, WA Indoor 18 m, NFAA Indoor Blue, Vegas.
2. **Multi-segment round** (chained single segments with possibly
   different faces, distances, and end sizes). E.g. WA 1440, NFAA 900.
3. **Course round** (24 / 28 targets, per-target arrow groups, no
   fixed end clock). E.g. WA Field 24, NFAA Field 28, NFAA Hunter 28.

The active segment's face and distance drive the rendered target and
the recorded shot distance; the `target_id` refreshes when the
segment advances.
