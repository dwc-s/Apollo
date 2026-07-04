"""Unit tests for the AGB 2023 handicap engine (handicap.py).

These validate the pure math against published Archery GB values and the
archeryutils reference implementation, with no Flask/DB dependency.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import handicap as hc


def _wa_zones_10(face_radius_mm, x_ring_mm):
    """Rebuild a WA 10-zone face the way apollo.py seeds it."""
    ring_w = face_radius_mm / 10.0
    out = [(10, x_ring_mm)]
    for i in range(10):
        out.append((10 - i, (i + 1) * ring_w))
    return out


WA_122 = _wa_zones_10(610.0, 30.5)   # 122 cm face
WA_80 = _wa_zones_10(400.0, 20.0)    # 80 cm face

# WA 1440 (90 m, men): 36 arrows each at 90/70 m on the 122 cm face and
# 50/30 m on the 80 cm face. Outdoor standard arrow.
WA1440_90_PASSES = [
    {"dist_m": 90.0, "n_arrows": 36, "zones": WA_122, "arrow_d_m": hc.ARROW_D_OUTDOOR},
    {"dist_m": 70.0, "n_arrows": 36, "zones": WA_122, "arrow_d_m": hc.ARROW_D_OUTDOOR},
    {"dist_m": 50.0, "n_arrows": 36, "zones": WA_80, "arrow_d_m": hc.ARROW_D_OUTDOOR},
    {"dist_m": 30.0, "n_arrows": 36, "zones": WA_80, "arrow_d_m": hc.ARROW_D_OUTDOOR},
]

# WA 720 (recurve): 72 arrows at 70 m on the 122 cm face.
WA720_PASSES = [
    {"dist_m": 70.0, "n_arrows": 72, "zones": WA_122, "arrow_d_m": hc.ARROW_D_OUTDOOR},
]


def test_sigma_t_matches_archeryutils_doctest():
    # archeryutils: agb_scheme.sigma_t(10.0, 25.0) == 0.0009498280098103058
    assert math.isclose(hc.sigma_t(10.0, 25.0), 0.0009498280098103058, rel_tol=1e-12)


def test_sigma_t_array_values():
    # archeryutils doctest array at dist 25 m for H = 10, 50, 100.
    expected = [0.00094983, 0.00376062, 0.02100276]
    for h, e in zip((10.0, 50.0, 100.0), expected):
        assert math.isclose(hc.sigma_t(h, 25.0), e, rel_tol=1e-5)


def test_normalize_zones_collapses_x_ring():
    bands = hc.normalize_zones(WA_122)
    # X+10 collapse to a single value-10 band at the 10-ring radius (61 mm).
    assert bands[0] == (10, 61.0)
    assert [v for v, _ in bands] == [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]


def test_handicap_from_score_wa1440_90_reference():
    # archeryutils: handicap_from_score(999, wa1440_90, int_prec=True) == 44
    assert hc.handicap_from_score(999, WA1440_90_PASSES, 1440) == 44


def test_handicap_from_score_nonboundary_reference():
    # Score 999 sits exactly on a rounding boundary (ceil(expected(44)) == 999),
    # so it can't tell the two rounding conventions apart. These are scores that
    # fall *between* table values — the case an off-by-one silently breaks. Each
    # RHS is archeryutils handicap_from_score(score, rnd, "AGB", int_prec=True).
    for score, expected in [(1100, 38), (1000, 44), (950, 47),
                            (900, 50), (800, 55)]:
        assert hc.handicap_from_score(score, WA1440_90_PASSES, 1440) == expected, score
    for score, expected in [(650, 19), (600, 30), (500, 44), (400, 54)]:
        assert hc.handicap_from_score(score, WA720_PASSES, 720) == expected, score


def test_handicap_rounds_to_worse_handicap():
    # The assigned integer handicap is ceil() of the continuous handicap: you
    # round to the *worse* (higher) whole handicap unless the score lands exactly
    # on the better one's tabled value. Equivalently the unrounded expected score
    # brackets it as expected(h) <= score < expected(h-1). A score assigned one
    # handicap too good (the pre-fix bug) violates the left inequality.
    for score in range(200, 716):
        h = hc.handicap_from_score(score, WA720_PASSES, 720)
        assert hc.expected_round_score(h, WA720_PASSES) <= score, (score, h)
        assert score < hc.expected_round_score(h - 1, WA720_PASSES), (score, h)


def test_handicap_monotonic_decreasing_in_score():
    prev = None
    for score in range(200, 720, 25):
        h = hc.handicap_from_score(score, WA720_PASSES, 720)
        if prev is not None:
            # higher score must never give a worse (larger) handicap
            assert h <= prev
        prev = h


def test_expected_score_decreases_with_handicap():
    e_good = hc.expected_round_score(10, WA720_PASSES)
    e_bad = hc.expected_round_score(60, WA720_PASSES)
    assert e_good > e_bad
    assert e_good <= 720


def test_perfect_and_invalid_scores():
    perfect = hc.handicap_from_score(720, WA720_PASSES, 720)
    assert perfect is not None
    # A perfect WA 720 is elite: a small/negative handicap, never the clamp
    # floor and never worse than a near-perfect score.
    assert hc.HC_MIN < perfect < 10
    assert perfect <= hc.handicap_from_score(719, WA720_PASSES, 720)
    assert hc.handicap_from_score(0, WA720_PASSES, 720) is None
    assert hc.handicap_from_score(721, WA720_PASSES, 720) is None
