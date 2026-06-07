# Tournament Target Faces

Specification of every target face Apollo seeds for tournament mode.
Radii are listed as the **outer edge** of the named ring, measured in
millimetres from the calibrated face center — the same convention the
`target_zones` table uses. All values are the canonical published
dimensions from the relevant rulebook; the code in `apollo.py` is the
source of truth and these tables match the in-code helpers.

## World Archery — outdoor target faces

### WA 122 cm 10-zone face

Used at 90 / 70 m. Ring width = 6.1 cm. X-ring is the inner-10
sub-ring (3.05 cm radius).

| Ring | Point value | Outer radius (mm) |
|---|---|---|
| Inner-10 (X) | 10 | 30.5 |
| 10 | 10 | 61 |
| 9 | 9 | 122 |
| 8 | 8 | 183 |
| 7 | 7 | 244 |
| 6 | 6 | 305 |
| 5 | 5 | 366 |
| 4 | 4 | 427 |
| 3 | 3 | 488 |
| 2 | 2 | 549 |
| 1 | 1 | 610 |

Colors center-out: gold (10/9), red (8/7), light blue (6/5), black
(4/3), white (2/1).

### WA 80 cm 10-zone face

Used at 50 / 30 m on the 1440 short distances. Ring width = 4.0 cm.
X-ring is the inner-10 (2.0 cm radius).

| Ring | Outer radius (mm) |
|---|---|
| Inner-10 (X) | 20 |
| 10 | 40 |
| 9 | 80 |
| 8 | 120 |
| 7 | 160 |
| 6 | 200 |
| 5 | 240 |
| 4 | 280 |
| 3 | 320 |
| 2 | 360 |
| 1 | 400 |

### WA 80 cm 6-ring face (compound 50 m)

Same ring widths as the 80 cm 10-zone face but only rings 5–10 are
printed. Anything outside the 5 ring (240 mm radius) scores M.

### WA 60 cm 10-zone face (indoor 25 m)

Ring width = 3.0 cm. X-ring is the inner-10 (1.5 cm radius). Rings at
15 / 30 / 60 / 90 / 120 / 150 / 180 / 210 / 240 / 270 / 300 mm.

### WA 40 cm 10-zone face (indoor 18 m, single-spot)

Ring width = 2.0 cm. X-ring radius = 1.0 cm. Recurve scoring: outer 10
and inner 10 both count as 10 (X is tiebreaker). Compound scoring on
this face uses the dedicated `wa_40_compound` zone list — only the
X-ring (inner-10) scores 10; the outer 10 ring is demoted to 9.

| Ring | Outer radius (mm) |
|---|---|
| Inner-10 (X) | 10 |
| 10 | 20 |
| 9 | 40 |
| 8 | 60 |
| 7 | 80 |
| 6 | 100 |
| 5 | 120 |
| 4 | 140 |
| 3 | 160 |
| 2 | 180 |
| 1 | 200 |

### Vegas 40 cm 3-spot face (per spot)

Three 20 cm spots stacked vertically; each spot shows rings 10–6 only.
Per-spot ring widths derived from the underlying WA 40 cm face. Apollo
records each shot against a single representative spot — the
one-arrow-per-spot rule is enforced visually only.

| Ring | Outer radius (mm) |
|---|---|
| Inner-10 (X) | 10 |
| 10 | 20 |
| 9 | 40 |
| 8 | 60 |
| 7 | 80 |
| 6 | 100 |

Anything outside 100 mm on the spot is a miss.

## World Archery — Field target faces

WA Field faces show **six** scoring rings, scoring 6 down to 1 (gold
center, black outer). Each ring is one-sixth of the face radius wide;
the X-ring (compound tiebreak) is half the 6-ring radius.

### WA Field 80 cm

Ring width = 66.67 mm. Rings at 33.33 / 66.67 / 133.33 / 200 /
266.67 / 333.33 / 400 mm (X / 6 / 5 / 4 / 3 / 2 / 1).

### WA Field 60 cm

Ring width = 50 mm. Rings at 25 / 50 / 100 / 150 / 200 / 250 / 300 mm.

### WA Field 40 cm

Ring width = 33.33 mm. Rings at 16.67 / 33.33 / 66.67 / 100 / 133.33 /
166.67 / 200 mm.

### WA Field 20 cm

Ring width = 16.67 mm. Rings at 8.33 / 16.67 / 33.33 / 50 / 66.67 /
83.33 / 100 mm. Compound bowmen use the dedicated `wa_field_20_compound`
zone list — only the inner-6 (X) scores 6; outer 6 demoted to 5.

## NFAA — indoor faces

### NFAA Indoor Blue 40 cm (single-spot)

Blue face, white rings. Used at 20 yards. Scoring 5 / 4 / 3 / 2 / 1
with X = 5 (tiebreaker).

| Ring | Point value | Outer radius (mm) |
|---|---|---|
| X | 5 | 20 |
| 5 | 5 | 40 |
| 4 | 4 | 80 |
| 3 | 3 | 120 |
| 2 | 2 | 160 |
| 1 | 1 | 200 |

### NFAA 5-spot 40 cm

Five small spots arranged as on a "5" die face. Each spot shows the
5 ring + X only.

| Ring | Point value | Outer radius (mm) |
|---|---|---|
| X | 5 | 20 |
| 5 | 5 | 40 |

One arrow per spot — double-hits score the lower as a miss (rule
documented; not enforced by Apollo).

## NFAA — Field / Hunter faces

NFAA Field and Hunter faces share the same scoring geometry —
three rings (5 / 4 / 3) with an X tiebreaker inside the 5 ring.
Apollo encodes the four standard face sizes (65 / 50 / 35 / 20 cm)
and uses the same zone list for both Field (white center, black
outer) and Hunter (black face, white spot) variants.

For each face the ring radii are 10% / 20% / 33.4% / 50% of the
face diameter. For the 65 cm face:

| Ring | Point value | Outer radius (mm) |
|---|---|---|
| X | 5 | 65 |
| 5 | 5 | 130 |
| 4 | 4 | 217 |
| 3 | 3 | 325 |

Other sizes scale proportionally.

## NASP

The `nasp_80` face row is retained for users with seeded targets from
earlier versions; NASP rounds are no longer offered in the tournament
selector. The face uses the WA 80 cm 10-zone layout.

## Image asset map

For every tournament face Apollo wants to render, it needs a square
PNG/JPG/WEBP under `static/targets/`. The seeded `targets` table row
points at that file with `image_filename = 'targets/<file>'`.

Until each image is sourced, the tournament route falls back to
`targets/nasp_40cm.jpg` (a bundled NASP face) as a visual
placeholder — **the scoring zones are correct for the requested
face** (encoded in code, seeded into `target_zones`), only the
backing photo is wrong. This means a user can run a "WA 720" round
today and have the score tally correctly; the only thing missing
is the precise visual face behind the scoring overlay.

Source candidates (public-domain or licensable):
- World Archery face artwork: published in WA Rulebook Book 3
  Appendix; vector PDFs at
  https://www.worldarchery.sport/rulebook
- NFAA face artwork: included in the NFAA Constitution & By-Laws
  PDF at nfaausa.com.

Once each image is sourced, drop it into `static/targets/` with the
agreed filename and Apollo will pick it up on the next user login —
the seeder updates `image_filename` on a mismatch.
