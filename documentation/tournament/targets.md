# Tournament Target Faces

Specification of every target face Apollo seeds for tournament mode,
plus the static image asset under `static/targets/` that represents it.

## Ring radius reference

The radius below is the **outer edge** of the named ring, measured in
millimetres from the face center. The next-smaller ring's outer edge
is the current ring's inner edge — this matches the data model in
`target_zones`.

### WA 122 cm 10-zone face

122 cm full face, ring width = 6.1 cm. Used at 90 / 70 / 60 m.

| Ring | Point value | Outer radius (mm) |
|---|---|---|
| Inner-10 (X) | 10 | 61 |
| 10 | 10 | 122 |
| 9 | 9 | 183 |
| 8 | 8 | 244 |
| 7 | 7 | 305 |
| 6 | 6 | 366 |
| 5 | 5 | 427 |
| 4 | 4 | 488 |
| 3 | 3 | 549 |
| 2 | 2 | 610 |
| 1 | 1 | 610 (== face edge) |

Colors center-out: gold (10/9), red (8/7), light blue (6/5), black
(4/3), white (2/1).

### WA 80 cm 10-zone face (recurve-style 50/30 m short distances)

Ring width = 4.0 cm. X-ring diameter 4 cm.

| Ring | Value | Outer radius (mm) |
|---|---|---|
| Inner-10 (X) | 10 | 20 |
| 10 | 10 | 40 |
| 9 | 9 | 80 |
| 8 | 8 | 120 |
| 7 | 7 | 160 |
| 6 | 6 | 200 |
| 5 | 5 | 240 |
| 4 | 4 | 280 |
| 3 | 3 | 320 |
| 2 | 2 | 360 |
| 1 | 1 | 400 |

### WA 80 cm 6-ring face (compound 50 m)

Identical to the 80 cm 10-zone face but only rings 5–10 are printed.
For scoring, anything outside the 5 ring (radius 240 mm) is a miss.

### WA 40 cm 10-zone face (indoor 18 m, single-spot)

Ring width = 2.0 cm. X-ring diameter 2 cm.

| Ring | Value (recurve) | Value (compound) | Outer radius (mm) |
|---|---|---|---|
| Inner-10 (X) | 10 | 10 | 10 |
| 10 | 10 | **9** | 20 |
| 9 | 9 | 9 | 40 |
| 8 | 8 | 8 | 60 |
| 7 | 7 | 7 | 80 |
| 6 | 6 | 6 | 100 |
| 5 | 5 | 5 | 120 |
| 4 | 4 | 4 | 140 |
| 3 | 3 | 3 | 160 |
| 2 | 2 | 2 | 180 |
| 1 | 1 | 1 | 200 |

### WA 40 cm 3-spot (vertical triple) face

Three reduced faces stacked vertically. Each spot is ~20 cm with rings
6–10 only (so the X / 10 / 9 / 8 / 7 / 6 rings are printed and the
1–5 rings are absent). The whole triple-face image is ~40 cm tall by
~20 cm wide.

Per-spot ring radii (mm): X = 10, 10 = 20, 9 = 40, 8 = 60, 7 = 80,
6 = 100.

### WA 60 cm 10-zone face (indoor 25 m)

Same layout as the 122 cm face but scaled down 50%. Ring width 3.0 cm.

### NFAA 40 cm Indoor Blue face (single-spot)

Blue face, white rings. Used at 20 yards.

| Ring | Value | Outer radius (mm) |
|---|---|---|
| X | 5 | 40 |
| 5 | 5 | 80 |
| 4 | 4 | 120 |
| 3 | 3 | 160 |
| 2 | 2 | 180 (narrow band) |
| 1 | 1 | 200 |

(The 1 and 2 rings on the Vermont-style blue face are very narrow; check
the current NFAA face specification — some implementations only print 3
zones plus X.)

### NFAA 5-spot face (40 cm overall)

5 small faces (X + 5 ring only) arranged in a "5" pattern on a 40 cm
square. Each face: X = 40 mm radius (4 cm), 5 = 80 mm radius (8 cm).
"One arrow per spot" — double-hits score the lower as a miss.

### NFAA / WA Vegas 40 cm 3-spot face

Three 20 cm faces stacked vertically, each showing rings 6–10 only.
Identical per-spot to the WA 40 cm 3-spot.

### NFAA Field faces (20 / 35 / 50 / 65 cm)

Three concentric zones: 5 (with X inside), 4, 3. Per face the rings
scale; example for 65 cm:

| Ring | Value | Outer radius (mm) |
|---|---|---|
| X | 5 | 65 |
| 5 | 5 | 130 |
| 4 | 4 | 217 |
| 3 | 3 | 325 |

All four face sizes preserve the same 5/4/3 area proportions.

### NFAA Hunter face

Same scoring rings as Field but printed as an all-black face with a
white center spot. Same radii in each of the 4 sizes.

### NASP 80 cm face

Same ring layout as the WA 80 cm face. Some NASP programs use a 122
cm face — verify the size for your league. Apollo's tournament mode
treats `nasp_round` as using the 80 cm face by default.

---

## Image asset map

For every tournament face Apollo wants to render, it needs a square
PNG/JPG/WEBP under `static/targets/`. The seeded `targets` table row
points at that file with `image_filename = 'targets/<file>'`.

| Face key | File (planned) | Status |
|---|---|---|
| `wa_122` | `targets/wa_122.png` | **needs source** — placeholder uses `wa_80.png` scaled |
| `wa_80` | `targets/wa_80.png` | **needs source** |
| `wa_80_6ring` | `targets/wa_80_6ring.png` | **needs source** |
| `wa_40` | `targets/wa_40.png` | **needs source** |
| `wa_40_3spot` | `targets/wa_40_3spot.png` | **needs source** |
| `wa_60` | `targets/wa_60.png` | **needs source** |
| `nfaa_indoor_blue` | `targets/nfaa_indoor_blue.png` | **needs source** |
| `nfaa_5spot` | `targets/nfaa_5spot.png` | **needs source** |
| `nfaa_vegas_3spot` | `targets/nfaa_vegas_3spot.png` | **needs source** |
| `nfaa_field_65` | `targets/nfaa_field_65.png` | **needs source** |
| `nasp_80` | `targets/nasp_40cm.jpg` | uses bundled NASP image (40 cm) — replace with proper 80 cm when sourced |

**Until an image is sourced** for a given face, the tournament route
falls back to `targets/nasp_40cm.jpg` (the bundled NASP face) as a
visual placeholder, while the **scoring zones are correct for the
requested face** (encoded in code, seeded into `target_zones`). This
means a user can run a "WA 720" round today and have the score
tally correctly; the only thing missing is the precise visual face
behind the scoring overlay.

Source candidates (public-domain or licensable):
- World Archery face artwork: published in WA Rulebook Book 3
  Appendix; vector PDFs available at
  https://www.worldarchery.sport/rulebook
- NFAA face artwork: included in the NFAA Constitution & By-Laws PDF
  and printed at-cost on nfaausa.com
- Open-source archery target SVGs: the GitHub repo `archery-targets`
  and the OpenClipArt collection.

Once each image is sourced, drop it into `static/targets/` with the
filename above and Apollo will pick it up on the next user login (the
seeder re-uses existing rows but updates `image_filename` on mismatch
— see the `_seed_tournament_targets()` function in `apollo.py`).
