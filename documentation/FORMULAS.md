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

**Accuracy (how close the arrows land to the gold):**
```
centroid (cx, cy) = (mean x, mean y)
mean_miss         = mean( hypot(x_i, y_i) )   # tracked accuracy — mean distance
                                              # of each shot from the bullseye
MPI               = hypot(cx, cy)             # centroid offset = the group's *bias*
bias_xy           = (cx, cy)                  # direction to move the sight
```
`mean_miss` is the metric every accuracy surface scores on (the accuracy
traces, the "most accurate quiver" record, accuracy goals, within-session
drift, conditions). Unlike MPI it penalises a *loose* group as well as an
off-centre one: a wide group straddling the gold has MPI ≈ 0 yet a large
`mean_miss`, so it can no longer read as "accurate". MPI and `bias_xy` are
retained as the group's **bias** — which way to move the sight — and still
drive the 2-D centroid test (Hotelling's T²).

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

### 2.1 Size- and sample-fair tightness (records board) — `_practice_pbs`
Ranking each completed quiver's tightness for the *Records* board can't use the
empirical R95 (`n < 10` falls back to the farthest arrow, which grows with end
size and hands the record to 3-arrow ends). It uses a **σ-model R95 with a small-
sample unbias**, so a full end and a short end of equal skill compare fairly:
```
r95_model = σ_r · √(_CHI2_2DOF_95 / 2) / c4          # σ_r from §2, half-width-normalized
dof       = 2(n − 1)                                 # both axes contribute
c4        = √(2/dof) · Γ((dof+1)/2) / Γ(dof/2)       # unbiases √(unbiased variance)
```
Without `c4`, `√` of an unbiased variance still underestimates σ for few shots
(a 3-arrow end keeps a ~6 % edge). The winner is chosen after a **James-Stein
shrink** of each end's `r95_model` toward the archer's own median end tightness
(`prior`), so a lucky short end is pulled back and only a robustly tight end wins:
```
var   = prior² / (4(n − 1))          # scales with the prior, not the end's own r95
w     = t² / (t² + c),  t² = (r95_model − prior)² / var,  c = _PREDICT_TREND_SHRINK_C
score = w · r95_model + (1 − w) · prior      # ties break toward more arrows
```
The same `_ap_series` per-session R95 feeds the "month your precision improved
most" figure (largest month-over-month drop in mean R95).

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

### 4.1 Expected score from a fit (server) — `_expected_score_fit`, `_report_expected_score`
The fit lives in one shared helper, `_expected_score_fit(zones, shots)`, so the
expected-score report and the vs-distance graph (§4.4) compute it identically.
Each **(face, distance)** group with ≥ 10 hits is fit on its own — a face shot at
18 m and 70 m becomes two panels (`{face} @ {n} m`), not one pooled fit that
blends a tight indoor group with a loose outdoor one into a spread describing
neither. Shots with no recorded distance form their own labelled panel.

Per group:
1. Fit a 2D Gaussian via `_archery_stats` → `(cx, cy, σ_x, σ_y, ρ)`.
2. Draw `N_SAMPLES = 20000` correlated samples (Cholesky of the covariance),
   from a **fixed-seed** RNG (`_EXPECTED_SCORE_MC_SEED = 424242`) so repeat
   renders are byte-identical and the two reports agree exactly on a shared
   group (the shared draw also acts as common random numbers, smoothing §4.4):
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

### 4.3 Distance-trend fit (server) — `apollo.py` (~13593)
The flat angular fit assumes dispersion is constant in mrad across range. When
the slice spans `≥ _PREDICT_TREND_MIN_DISTANCES` (2) distinct distances, each
with `≥ _PREDICT_TREND_MIN_PER_DIST` (15) hits, Apollo additionally regresses
how **bias** and **dispersion** grow with distance and returns it as
`dist.trend` for the client to apply when extrapolating.

A raw least-squares trend on few distances is noisy, so each fitted growth
slope is **shrunk James-Stein-style toward a prior** rather than used flat. The
dispersion-growth prior is the AGB handicap distance coefficient
(`KD = 0.00365 /m`, see §7) — i.e. "absent strong evidence, dispersion grows
with range the way the handicap model says it does," not "stays flat." The
shrink weight uses softness `_PREDICT_TREND_SHRINK_C = 4.0`: a departure from
the prior with `|t| = √c` earns half weight; larger `c` keeps the trend nearer
its prior unless the data strongly disagrees. Below the data threshold the
model falls back to the flat angular fit (§4.2).

### 4.4 Expected points/arrow vs distance — `_report_expected_score_vs_distance`
Reuses the §4.1 per-(face, distance) fit and lays every distance on one axis, one
line per scoring face, so the score's drop-off with range is visible at a glance
(a steep line = distance costs you disproportionately; a flat one = your form
holds). A face shot at ≥ 2 known distances becomes a trend line; at a single
distance, one marker. Because both reports share the fixed-seed helper, a point
here equals the matching panel in §4.1 exactly. `% of max = expected / max_ring · 100`.

---

## 5. Reports built on the above

Every `/analyze` report below feeds shot clouds (raw mm or normalized) into
`_archery_stats` and/or the tests in §3; this lists the aggregation each one adds.

| Report | Function | Aggregation |
|---|---|---|
| Hits by zone | `_report_hits_by_boundaries` | `count` per zone + miss; `pct = count/total·100`. |
| Arrows over time | `_report_arrows_vs_time` | arrows per calendar day, zero-filled gaps. |
| Accuracy over time | `_report_accuracy_over_time` | `_archery_stats` per day/week/month bucket → MPI, R95. |
| Accuracy/precision traces | `_report_accuracy_precision_traces` | mean miss & R95 per session / per quiver / all-time rolling; optional per-bow/arrow/tag overlay; each trace carries a faint same-colour linear trend line. |
| Biggest vs smallest spread per quiver | `_report_quiver_spread` | per quiver, max & min pairwise arrow distance (half-width normalized) with a trend line through each. |
| Horizontal & vertical spread violins | `_report_spread_violins` | per time bucket (session, or month once there are many), pool each arrow's offset from its quiver's centroid in cm; two-row violin — horizontal spread with time on x, vertical spread with the axes transposed. |
| Within-session drift | `_report_within_session_drift` | pool shots by quiver index across sessions → mean miss, R95. |
| Cold bore vs warmed | `_report_cold_bore_vs_warmed` | first-shot vs rest; Mann-Whitney U on distances. |
| Draw-weight traces | `_report_draw_weight_traces` | MPI/R95 vs draw weight, split rated vs effective. |
| Shot-density heatmap | `_report_shot_density_heatmap` | hexbin (gridsize 22) + quadrant %; needs ≥ 25 hits. |
| Calendar heatmap | `_report_calendar_heatmap` | shots per day → colour intensity. |
| Expected score | `_report_expected_score` | §4.1 (one panel per face × distance). |
| Expected points/arrow vs distance | `_report_expected_score_vs_distance` | §4.4. |
| Performance vs conditions | `_report_conditions` | §7.7. |
| Equipment head-to-head | `_report_equipment_head_to_head` | §3. |
| Handicap over time | `_report_handicap_trend` + `_handicap_summary` | per-round AGB handicap (§7) vs date; least-squares trend line; best-three average (§7.4). |

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
- **Distance is canonical metres** (`static/apollo-units.js`): the score/edit
  pages keep a hidden metres field beside the visible one and convert on input and
  on unit toggle (`m = yd · 0.9144`), so an Imperial entry never reaches the DB,
  the submit, or the offline queue as yards. Reports and `/predict` read the column
  as metres; the Previous-Sessions distance filter matches on metres but relabels
  each option to the reader's unit.

---

## 7. Archery GB handicaps & classifications

The handicap math lives in `handicap.py`; the constant tables in
`handicap_data.py`; the class/award resolvers in `classifications.py`. All
three are pure (no Flask/DB) and unit-tested in isolation. `apollo.py` builds
their inputs from `TOURNAMENT_FACES` / `_round_segments` and exposes them via
`_round_handicap_passes`, `_session_handicap`, and `_session_handicap_awards`.
Constants match the MIT-licensed `archeryutils` reference, so figures agree
with published AGB tables and archerycalculator.co.uk.

### 7.1 Angular spread model (AGB 2023) — `sigma_t`, `sigma_r`
```
sigma_t(H, d) = ANG_0 · (1 + STEP/100)^(H + DATUM) · e^(KD · d)      [rad]
sigma_r(H, d) = d · sigma_t(H, d)                                    [m, group SD]
```
Constants: `ANG_0 = 5.0e-4`, `STEP = 3.5` (% per handicap step), `DATUM = 6.0`,
`KD = 0.00365 /m` (distance growth — also the prior in §4.3). Lower `H` = tighter
group = better. The scale is searched over integer `H ∈ [HC_MIN, HC_MAX] = [-75, 300]`.

### 7.2 Expected score — `expected_arrow_score`, `expected_round_score`
Rings are first collapsed to scoring **bands** (`normalize_zones`): equal-value
rings (e.g. the X and outer-10 both worth 10) merge to the largest radius at
which that value scores. For an arrow of *scheme-standard* radius `arw_rad`:
```
s̄(H,d) = max_v − Σ_k drop_k · exp(−((arw_rad + r_k) / sigma_r)²)
```
summed over each band boundary (`r_k` = outer radius in m, `drop_k` = points
lost to the next band out, 0 outside the last band). A round's expected score is
`Σ n_arrows · s̄` over its passes; the **predicted** table score is `⌈expected⌉`.

The arrow radius is fixed by the scheme, **not** the archer's real shaft —
`ARROW_D_OUTDOOR = 5.5 mm`, `ARROW_D_INDOOR = 9.3 mm` (diameters) — so handicaps
are comparable across archers. The raw score itself is still scored with the
archer's real arrow (§1.1).

### 7.3 Score → handicap — `handicap_from_score`
`expected_round_score(H)` is strictly decreasing in `H`. The assigned handicap is
`⌈` the *continuous* handicap that predicts the score `⌉` — i.e. the **smallest**
integer `H` whose **unrounded** expected round score has dropped to `≤` the
achieved score. On the descending AGB scale you round to the *worse* (higher)
whole handicap unless the score lands exactly on the better one's tabled value.

A **plateau step** then advances to the worst `H` whose ceil-rounded table score
still meets the achieved score: `⌈expected⌉` is a step function, so near the
extremes several handicaps share one tabled score and a tie must resolve to the
worst `H` — never award a better handicap than the published table. The same step
lands a maximum score on the worst `H` that still rounds up to the max (its
expected value only approaches the max asymptotically), so no special-case is
needed. Scores `≤ 0` or `> max_score` return `None`.

> This mirrors `archeryutils`' integer AGB algorithm exactly across the usable
> score range. The earlier "largest `H` whose ceil-rounded score is still `≥` the
> achieved score" reading looked equivalent but was off by one for every score
> that doesn't sit on a rounding boundary — one handicap too *good* — which
> silently over-classified borderline scores. Fixed in **v0.97**; guarded by
> non-boundary regression tests in `tests/test_handicap.py`.

### 7.4 Headline figures — `_handicap_summary`
From the list of completed-round handicaps (ascending by date):
- **latest** — most recent round's handicap.
- **best_recent** — lowest single handicap in the 12 months up to the latest round.
- **agb** — `⌊(sum of the best three handicaps) / 3⌋` (the 2023 scheme rounds the
  average **down**). Pool preference: current season (calendar year of the latest
  round) → trailing 12 months → all rounds, flagged provisional below a full
  season, and `None` with fewer than three rounds. `agb_basis` records which pool was used.

Every completed AGB-target round counts (Apollo has no record-status notion), so
the figure is a personal tracking number, not a club-submitted one.

### 7.5 Classifications — `classifications.py`
- **Archery GB** (`agb_classification`): per-category threshold handicaps
  (`agb_class_thresholds`) computed from a `datum + (i − index_offset)·classStep`
  ladder plus an age/gender step (`agb_age_gender_step`, including the U16
  alignment fiddle). Indoor and outdoor use separate datums/steps; the best class
  met is the first whose threshold the handicap satisfies. Master Bowman is flagged
  `record_status` (officially record-event only; shown for information).
- **World Archery** (`wa_star_award`): Star Awards on the 1440 round — fixed
  point-score milestones (`WA_STAR_AWARDS`), `record_status` at ≥ 1350.
- **USA Archery** (`usaa_award`): WA Performance Award pins on the 1440 (`USAA_AWARDS`).
- `resolve_awards` returns every award earned across the three schemes. NFAA is
  deferred — it's a relative multi-score scheme, not a single-round lookup.

### 7.6 Goal projection — `_project_handicap`
On the completed-round points (ascending by date, lower handicap = better) fit
the same least-squares line as the trend report on ordinal days:
`slope, intercept = polyfit(days_from_first, handicaps, 1)`, reported as
`slope_per_year = slope · 365`. With a deadline `D`, the projected handicap is
`intercept + slope · (D − first_date_in_days)`. Grading vs a target `H*`:
- **achieved** — `latest ≤ H*`.
- **no_trend** — only one round (no slope).
- with a deadline: **on_track** if `projected ≤ H*`, else **behind**; the
  required rate to hit the target from the latest round is
  `((H* − latest) / days_left) · 365`.
- with no deadline: **on_track** while the slope is improving (`< 0`), else **behind**.
A classification goal resolves its class's threshold handicap (`agb_class_thresholds`)
and projects against that. Volume goals compare arrows shot in the current
week/month (from the shot calendar) to the target, paced by the fraction of the
period elapsed.

### 7.7 Performance vs conditions — `_report_conditions`
Each hit whose session captured weather is normalized by target half-width (as
in the other reports) and bucketed by **wind band** (calm `< 8`, light `8–19`,
moderate `19–30`, strong `≥ 30` km/h — roughly Beaufort 0-2 / 3-4 / 5 / 6+) and
by **temperature band** (`< 8`, `8–18`, `18–26`, `≥ 26 °C`). `_archery_stats`
runs per bucket; MPI and R95 are reported as a percentage of the target
half-width. Buckets below five hits are flagged as thin.

---

*Generated and verified against the implementation for v0.97. When a formula
changes in `apollo.py`, `apollo-predict.js`, `handicap.py`, or
`classifications.py`, update the matching section here.*
