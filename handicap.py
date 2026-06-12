"""Archery GB handicap mathematics (AGB 2023 scheme).

A *handicap* is a single precision number that is comparable across rounds
and distances: lower is better. This module implements the official Archery
GB 2023 handicap scheme, which is round-agnostic — it derives an expected
score from a target's concentric ring geometry and a shooting distance, so
it works on any of Apollo's WA / USAA / NFAA faces.

The formulas and constants here match the open-source, MIT-licensed
``archeryutils`` reference implementation by Jack Atkinson (a co-author of the
AGB 2023 scheme), so a score looked up here agrees with the published Archery
GB tables and archerycalculator.co.uk.

This module is deliberately pure: no Flask, no database, no import of
``apollo``. Callers pass in plain ring geometry and distances. That keeps it
unit-testable in isolation and avoids a second source of truth for faces —
``apollo`` builds the inputs from its existing ``TOURNAMENT_FACES`` and
``_round_segments``.

Key model (AGB 2023):

    sigma_t(H, d) = ANG_0 * (1 + STEP/100) ** (H + DATUM) * exp(KD * d)
    sigma_r       = d * sigma_t                         # group SD, metres
    s_bar         = max_v - Σ_k drop_k *
                            exp(-((arw_rad + r_k) / sigma_r) ** 2)

where the sum runs over each scoring-ring boundary (outer radius ``r_k`` in
metres, point drop ``drop_k`` to the next ring out, with 0 outside the last
ring), and ``arw_rad`` is the *scheme-standard* arrow radius (5.5 mm outdoor,
9.3 mm indoor). The handicap uses the standard arrow on purpose so the number
matches published tables and is comparable between archers — the raw score it
is looked up from is still computed by Apollo with the archer's real arrow.
"""

from __future__ import annotations

import math

# ── AGB 2023 scheme constants (archeryutils "AGB" scheme) ──────────────────
ANG_0 = 5.0e-4   # baseline angular deviation [rad]
STEP = 3.5       # % change in group size per handicap step
DATUM = 6.0      # handicap datum offset
KD = 0.00365     # distance growth coefficient [1/m]

# Scheme-standard arrow diameters [m]. The handicap model uses these fixed
# values (not the archer's real shaft) so handicaps match published tables.
ARROW_D_OUTDOOR = 5.5e-3
ARROW_D_INDOOR = 9.3e-3

# AGB uses a descending scale rounded UP (ceil). archeryutils bounds the
# practical scale at [-75, 300]; we search integers across that range.
HC_MIN = -75
HC_MAX = 300


def sigma_t(handicap: float, dist_m: float) -> float:
    """Angular standard deviation [rad] for a handicap at a distance."""
    return ANG_0 * (1.0 + STEP / 100.0) ** (handicap + DATUM) * math.exp(KD * dist_m)


def sigma_r(handicap: float, dist_m: float) -> float:
    """Group radial standard deviation [m] for a handicap at a distance."""
    return dist_m * sigma_t(handicap, dist_m)


def normalize_zones(zones):
    """Collapse a raw face's rings to scoring boundaries, outer→in order.

    ``zones`` is Apollo's innermost-out list of ``(point_value,
    outer_radius_mm[, ...])`` tuples (an X-ring shares the 10's value, etc.).
    Returns a list of ``(point_value, outer_radius_mm)`` with *strictly
    decreasing* point values, where rings of equal value are merged to the
    largest radius at which that value is still scored. Anything outside the
    last entry scores 0.

    Example (WA 122cm): the X (r=30.5, v=10) and 10 ring (r=61, v=10) collapse
    to a single ``(10, 61)`` band, so the 10→9 drop sits at 61 mm.
    """
    # Sort by radius ascending; keep the largest radius per descending value.
    parsed = []
    for z in zones:
        value = int(z[0])
        radius = float(z[1])
        parsed.append((radius, value))
    parsed.sort()  # by radius ascending

    # Walk outward, recording the outer radius at which each value band ends.
    bands = []  # (value, outer_radius_mm)
    for radius, value in parsed:
        if bands and bands[-1][0] == value:
            # same value extends further out — push the boundary outward
            bands[-1] = (value, radius)
        else:
            bands.append((value, radius))
    return bands


def expected_arrow_score(handicap: float, dist_m: float, zones, arrow_d_m: float) -> float:
    """Expected points for a single arrow on ``zones`` at ``dist_m``."""
    bands = normalize_zones(zones)
    if not bands:
        return 0.0
    sig_r = sigma_r(handicap, dist_m)
    arw_rad = arrow_d_m / 2.0
    max_v = max(v for v, _ in bands)

    # s_bar = max - Σ drop_k * exp(-((arw_rad + r_k)/sigma_r)^2),
    # drop_k = value_k - value_{k+1}, with 0 outside the last band.
    total_drop = 0.0
    for k, (value, radius_mm) in enumerate(bands):
        next_value = bands[k + 1][0] if k + 1 < len(bands) else 0
        drop = value - next_value
        if drop <= 0:
            continue
        r_m = radius_mm / 1000.0
        total_drop += drop * math.exp(-(((arw_rad + r_m) / sig_r) ** 2))
    return max_v - total_drop


def expected_round_score(handicap: float, passes) -> float:
    """Expected (unrounded) round score.

    ``passes`` is a list of dicts, one per segment/distance, each with:
    ``dist_m`` (float), ``n_arrows`` (int), ``zones`` (raw face zones) and
    ``arrow_d_m`` (scheme-standard arrow diameter for the round).
    """
    total = 0.0
    for p in passes:
        total += p["n_arrows"] * expected_arrow_score(
            handicap, p["dist_m"], p["zones"], p["arrow_d_m"]
        )
    return total


def _round_predicted(handicap: float, passes) -> int:
    """Predicted round score as it appears in the tables: ceil of expected."""
    return math.ceil(expected_round_score(handicap, passes))


def handicap_from_score(score, passes, max_score):
    """Integer AGB handicap for ``score`` on a round described by ``passes``.

    Mirrors archeryutils' AGB integer algorithm: the assigned handicap is the
    *largest* integer H whose ceil-rounded predicted round score is still at
    least ``score`` (descending scale, round up). A perfect score is handled
    specially (lowest H whose expected score reaches within the rounding
    limit of the maximum).

    Returns an int handicap, or ``None`` if the score is non-positive or above
    the round maximum.
    """
    if score is None:
        return None
    score = float(score)
    if score <= 0.0 or score > float(max_score):
        return None

    # ceil(predicted) is non-increasing in H. Scan from best to worst and keep
    # the last H that still meets the score; stop once it drops below. This is
    # correct for a maximum score too: ceil(expected) == max only while
    # expected > max-1, so the scan lands on the worst handicap that still
    # rounds up to the maximum (a small/negative number), not the clamp floor.
    best = None
    for h in range(HC_MIN, HC_MAX + 1):
        if _round_predicted(h, passes) >= score:
            best = h
        elif best is not None:
            break
    return best if best is not None else HC_MAX
