# Apollo — Formulas & Math Reference

A single catalogue of every scoring, statistical, and predictive formula Apollo
uses, with the source function and file for each so the document stays traceable.
Unless noted, coordinates are in **millimetres** with the origin at the centre of
the target face, and statistics that pool across faces are first **normalized by
the target half-width** (`1.0` = the target edge) so 40 cm and 60 cm faces can be
compared fairly.

Key shared constants (`apollo.py`):

| Constant | Value | Meaning |
|---|---|---|
| `MISS_SENTINEL` | `'100000'` | `x == y == 100000` flags a deliberate miss. |
| `DEFAULT_SHAFT_DIAMETER_MM` | `6.0` | Fallback shaft Ø when an arrow has none recorded. |
| `_HEAD_TO_HEAD_MIN_SHOTS` | `5` | Min shots per piece/tag for a head-to-head comparison. |
| `_CHI2_2DOF_50` | `2·ln 2 ≈ 1.3863` | χ²⁻¹(0.50, df=2) — CEP scaling. |
| `_CHI2_2DOF_95` | `2·ln 20 ≈ 5.9915` | χ²⁻¹(0.95, df=2) — R95 scaling. |

---

## 1. Scoring & geometry

### 1.1 Line-cutter effective distance
`_classify_shot`, `_score_one_shot`, `_shot_is_x` (`apollo.py` ~8218–8400).

A shot's distance from centre is reduced by the shaft *radius*, so any part of
the arrow touching a higher ring scores that ring (the standard line-cutter rule):

```
shaft_radius = shaft_diameter_mm / 2          # default 6 mm → 3 mm radius
d_eff        = max(0, hypot(x, y) − shaft_radius)
```

`_classify_shot` walks `zones` innermost-out and returns the first zone whose
`radius_mm ≥ d_eff` (index 0 = innermost), or `None` for a miss or an out-of-zone
hit. `_score_one_shot` maps that index to its `point_value` (0 for `None`).
`_shot_is_x` reuses the same `d_eff` and tests `d_eff ≤ x_ring_radius`.

### 1.2 Multi-spot faces (e.g. NFAA 5-spot)
Same functions, `spot_centers_mm` branch.

When a face has multiple identical spots, the shot is scored against the
**nearest** spot centre:

```
d_eff = min over spots of hypot(x − sx, y − sy) − shaft_radius
```

so a click anywhere on the face lands on the closest scoring spot. Spot centres
are resolved by `_target_multi_spot_centers()` (target name → tournament
`face_key` → `TOURNAMENT_FACES[...]['multi_spot']['centers_mm']`).

### 1.3 World Archery ring builder
`_wa_zones_10` (and `_wa_zones_6`, `_wa_zones_vegas`) (`apollo.py` ~163).

For a WA 10-zone face of outer radius `R`:

```
ring_w        = R / 10                  # each scoring ring is 1/10 of the radius
ring i (0..9): point_value = 10 − i,  outer_radius = (i + 1) · ring_w
X ring:        point_value = 10,      outer_radius = x_ring_radius_mm
```

The 6-ring 50 m face keeps the same `ring_w = R/10` but only prints rings 10..5;
anything past the 5 ring is a miss.

### 1.4 Quiver, end & tournament aggregation
`_compute_quiver_score`, `_compute_tournament_progress` (`apollo.py` ~1471, ~8391).

- **Quiver score** = Σ `_score_one_shot()` over the shots in a quiver.
- **Tournament progress** accumulates, per end and as a running total:
  `total_score` (Σ points), `x_count` (Σ `_shot_is_x`), `ten_count` (shots equal
  to the segment's max ring value), and `end_total` grouped by `arrows_per_end`.
  Multi-segment rounds (e.g. WA 1440) resolve each shot's face/end size via
  `_round_segments()` / `_segment_for_shot()`.
- **Total arrows in a round** (`_round_total_arrows`):
  `Σ arrows_per_end · ends` over all segments (supersedes any stored count).

### 1.5 Set-play (head-to-head match) points
Score-sheet logic (`apollo.py` ~6055). Per settled end, comparing the two
archers' end totals (WA 12.1.4.1):

```
higher end total → +2 set points;  tie → +1 each.  First to 6 set points wins.
```

---

## 2. Shot-cloud statistics

`_archery_stats(xs, ys)` (`apollo.py` ~9946) is the workhorse behind most
`/analyze` reports. It separates the two archery error modes:

**Accuracy (bias of the group):**
```
centroid (cx, cy) = (mean x, mean y)
MPI               = hypot(cx, cy)        # how far the group sits off centre
bias_xy           = (cx, cy)             # direction to move the sight
```

**Precision (spread about the group's own centroid):**
```
d_i      = hypot(x_i − cx, y_i − cy)
MR       = mean(d_i)                                   # mean radius
var_x    = Σ(x − cx)² / (n − 1)        (n ≥ 2)         # unbiased
var_y    = Σ(y − cy)² / (n − 1)
σ_x, σ_y = √var_x, √var_y
cov_xy   = Σ(x − cx)(y − cy) / (n − 1)
ρ        = cov_xy / (σ_x · σ_y)                        # 0 if either σ = 0
σ_r      = √(var_x + var_y)                            # 1σ radius about centroid
extreme_spread = max pairwise distance (O(n²))
```

**CEP (50%) and R95 (95%) radii** — radius containing that fraction of shots:

- **n < 10 — empirical** nearest-rank percentile of the sorted `d_i`:
  `k = ⌈p·n⌉ − 1`, clamped to `[0, n−1]`.
- **n ≥ 10 — fitted.** If the group is near-isotropic
  (`|ρ| < 0.2` **and** `max σ ≤ 1.2 · min σ`), the **Rayleigh** closed form:
  ```
  σ_iso²  = (σ_x² + σ_y²) / 2
  CEP     = √(_CHI2_2DOF_50 · σ_iso²)   = σ_iso · √(2 ln 2)
  R95     = √(_CHI2_2DOF_95 · σ_iso²)   = σ_iso · √(2 ln 20)
  ```
  Otherwise (tilted/elongated), use the **covariance eigenvalues**:
  ```
  tr   = σ_x² + σ_y²
  det  = σ_x²·σ_y² − cov_xy²
  λ1,2 = tr/2 ± √(tr²/4 − det)
  geom = √(λ1 · λ2)                     # = √det, the ellipse's equivalent σ²
  CEP  = √(_CHI2_2DOF_50 · geom),  R95 = √(_CHI2_2DOF_95 · geom)
  ```

The general radius identity is `R_q = √(χ²⁻¹(q, 2) · σ²)`, i.e.
`R_q = σ·√(−2 ln(1 − q))` for the isotropic case — see `_chi2_ppf_df2`.

---

## 3. Equipment / tag head-to-head tests

`_report_equipment_head_to_head` (`apollo.py` ~10362) compares two pieces of kit
(or two session tags) across **three independent question families**, each with
its own test and its own Holm-Bonferroni correction. Pairs that ever co-occurred
in the same session are dropped (`_cooccurring_pairs`), and each side needs
≥ `_HEAD_TO_HEAD_MIN_SHOTS` shots. All inputs are target-half-width normalized.

| Question | Test | Input |
|---|---|---|
| **Accuracy** — do the centroids differ? | Hotelling's T² | 2D normalized shot vectors |
| **Precision** — does one group cluster tighter about *its own* centroid? | Brown-Forsythe | distance from each group's own centroid |
| **Total error** — does one simply land closer to the bull? | Mann-Whitney U + Cliff's δ | distance from target centre |

### 3.1 Mann-Whitney U (total error) — `_mann_whitney_u` (~9696)
Two-sided; returns the smaller conventional U. Rank-based (so it ignores the
right-skew and the lower bound at 0 that would trip Welch's t). With scipy it
calls `mannwhitneyu`; otherwise the normal approximation with tie + continuity
correction:
```
U1 = R1 − n1(n1+1)/2,   U2 = n1·n2 − U1,   U = min(U1, U2)
var = (n1·n2/12) · [ (N+1) − Σ t(t²−1) / (N(N−1)) ]      # N = n1+n2, ties t
z   = (U − n1·n2/2 ∓ 0.5) / √var                         # continuity-corrected
p   = 2·(1 − Φ(|z|))
```

### 3.2 Cliff's δ (effect size) — `_cliffs_delta` (~9754)
```
δ = (#{a > b} − #{a < b}) / (n1·n2)  ∈ [−1, +1]
```
For distance-from-centre data, `δ > 0` means sample `a` lands farther out (so `b`
is the more accurate piece). Paired with the Mann-Whitney p-value.

### 3.3 Brown-Forsythe (precision) — `_brown_forsythe` (~9775)
Median-centered Levene's test. For two groups it reduces to an equal-variance
t-test on the absolute deviations from each group's median; reported as `F = t²`:
```
z1_i = |a_i − median(a)|,   z2_i = |b_i − median(b)|
m1, m2 = mean(z1), mean(z2)
s_pooled = [ Σ(z1−m1)² + Σ(z2−m2)² ] / (n1+n2−2)
SE = √( s_pooled · (1/n1 + 1/n2) )
t  = (m1 − m2)/SE,   F = t²,   df = (1, n1+n2−2),   p = _f_sf(F, 1, df2)
```

### 3.4 Hotelling's T² (accuracy) — `_hotelling_t2` (~9806)
Two-sample multivariate test on the 2D centroids; needs n ≥ 3 per side and a
non-singular pooled covariance:
```
pooled cov S = [ (n1−1)S1 + (n2−1)S2 ] / (n1+n2−2)
Δ = (mx1−mx2, my1−my2)
T² = (n1·n2/(n1+n2)) · Δᵀ S⁻¹ Δ
F  = T² · df2 / (df1 · (n1+n2−2)),   df1 = 2,  df2 = n1+n2−3
p  = _f_sf(F, df1, df2)
```

### 3.5 Holm-Bonferroni correction — `_holm_bonferroni` (~9853)
Step-down family-wise control, applied **within** each test family. With raw
p-values sorted ascending and `m` non-null tests:
```
adj_(rank) = min(1, p_(rank) · (m − rank))      # rank = 0 for the smallest p
```
made monotone (a smaller raw p never yields a larger adjusted p); `None` entries
pass through and don't count toward `m`.

### 3.6 Scipy-free numerics (fallbacks)
- `_std_normal_cdf(z) = ½(1 + erf(z/√2))` — Φ for the U-test p-value.
- `_regularized_incomplete_beta(x, a, b)` — `I_x(a, b)` via Lentz's continued
  fraction (~1e-7), the engine for t/F survival functions.
- `_f_sf(f, df1, df2)` — right tail of F; scipy's `f.sf` when present, else
  `I_x(df2/2, df1/2)` with `x = df2/(df2 + df1·f)`.
- `_chi2_ppf_df2(q) = −2·ln(1 − q)` — closed-form inverse CDF of χ²(df=2).

---

## 4. Prediction & Monte-Carlo

### 4.1 Expected score from a fit (server) — `_report_expected_score` (~12108)
For each scoring target with ≥ 10 hits:
1. Fit a 2D Gaussian via `_archery_stats` → `(cx, cy, σ_x, σ_y, ρ)`.
2. Draw `N_SAMPLES = 20000` correlated samples (Cholesky of the covariance):
   ```
   X = cx + σ_x · z1
   Y = cy + σ_y · (ρ_clip · z1 + √(1 − ρ_clip²) · z2),    z1,z2 ~ N(0,1)
   ```
   `ρ` is clamped to `±0.999`. Each sample is scored with `_classify_shot`
   (a typical 6 mm shaft; boundary mis-classification is well inside MC noise).
3. **Blend in the empirical miss rate** `m = n_misses / n_total`. Misses are
   extra outside-mass the Gaussian can't produce:
   ```
   eff_samples = N + ⌊N · m/(1−m)⌋ = N/(1−m)
   p_ring_i    = ring_hits_i / eff_samples
   p_outside   = (outside + (eff_samples − N)) / eff_samples
              = (1 − m)·(gaussian outside fraction) + m        # see note
   ```
   so the per-ring probabilities are scaled down by `(1−m)` and `m` is added to
   the miss probability — exactly an `m`-vs-`(1−m)` mixture of "guaranteed miss"
   and "Gaussian sample."
4. `expected_score = Σ p_ring_i · point_value_i`, plus per-end projections at
   end lengths `(3, 6, 10)`.

### 4.2 Client Monte-Carlo simulator — `runOnce()` in `static/apollo-predict.js` (~191)
The server hands the page a mean offset and covariance **in milliradians** plus
the round's segments; the browser simulates whole tournaments. Angular dispersion
scales linearly with distance (`1 mrad at 1 m = 1 mm`), so per segment:
```
distMmPerMrad = segment.distance_m
muX, muY      = meanMrad · distMmPerMrad
per arrow:  with prob missRate → miss (score 0); else
            z1, z2 ~ randn()                         # Box-Muller
            ex = l11·z1                              # precomputed Cholesky
            ey = l21·z1 + l22·z2
            xMm = muX + ex·distMmPerMrad,  yMm = muY + ey·distMmPerMrad
            total += scoreShot(xMm, yMm, zones)      # mirrors line-cutter rule
```
Across `nRuns` runs the page computes mean, sample std `√(Σ(s−mean)²/(n−1))`,
min/max, and **linearly-interpolated** percentiles
(`k = (n−1)·p`, interpolate between `⌊k⌋` and `⌈k⌉`) for p10/p50/p90, plus the
probability of clearing a target score.

---

## 5. Reports built on the above

Every `/analyze` report below feeds shot clouds (raw mm or normalized) into
`_archery_stats` and/or the tests in §3; this lists the aggregation each one adds.

| Report | Function | Aggregation |
|---|---|---|
| Hits by zone | `_report_hits_by_boundaries` | `count` per zone + miss; `pct = count/total·100`. |
| Arrows over time | `_report_arrows_vs_time` | arrows per calendar day, zero-filled gaps. |
| Accuracy over time | `_report_accuracy_over_time` | `_archery_stats` per day/week/month bucket → MPI, R95. |
| Accuracy/precision traces | `_report_accuracy_precision_traces` | MPI & R95 per session / per quiver / all-time rolling. |
| Within-session drift | `_report_within_session_drift` | pool shots by quiver index across sessions → MPI, R95. |
| Cold bore vs warmed | `_report_cold_bore_vs_warmed` | first-shot vs rest; Mann-Whitney U on distances. |
| Draw-weight traces | `_report_draw_weight_traces` | MPI/R95 vs draw weight, split rated vs effective. |
| Shot-density heatmap | `_report_shot_density_heatmap` | hexbin (gridsize 22) + quadrant %; needs ≥ 25 hits. |
| Calendar heatmap | `_report_calendar_heatmap` | shots per day → colour intensity. |
| Expected score | `_report_expected_score` | §4.1. |
| Equipment head-to-head | `_report_equipment_head_to_head` | §3. |

---

## 6. Time, dates & units

- **UTC ↔ local** (`_utc_to_user`): DB datetimes are stored UTC-naive; display
  treats them as UTC and converts to the user's IANA timezone (falls back to UTC
  if the zone is missing/invalid).
- **Session duration** (`get_stats`): a manual override is `minutes · 60` seconds;
  otherwise `end − begin`, then `divmod` into days/hours/minutes/seconds.
- **Date bucketing** (`_accuracy_bucket_period`): day / week (week-start) / month
  granularity auto-selected from the span.
- **Hit / miss percentages**: guarded by a non-zero denominator
  (`percent_hit = hit/arrows·100`); display-only, never part of a score.

---

*Generated and verified against the implementation for v0.60. When a formula
changes in `apollo.py` or `apollo-predict.js`, update the matching section here.*
