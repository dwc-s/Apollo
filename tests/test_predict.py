"""Unit tests for the /predict distance-trend angular fit (apollo.py).

Pure-math tests on ``_fit_angular_trend`` — synthetic shot clouds with a
known bias and dispersion growth let us check parameter recovery, shrinkage
toward the handicap population prior, and the single-distance fallback to the
legacy flat fit. No Flask/DB beyond importing the module.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo

KD = apollo.handicap.KD


def _make_samples(distances, n_per, a_mm, b_mrad, s0_mrad, k, seed=1):
    """Synthetic hits with x-mean ``μ_mm = a + b·d`` (y centered) and an
    isotropic angular σ of ``s0·e^(k·d)`` mrad → linear σ of ``s0·e^(k·d)·d``.
    """
    rng = random.Random(seed)
    out = []
    for d in distances:
        sigma_mm = s0_mrad * math.exp(k * d) * d
        mu_x = a_mm + b_mrad * d
        for _ in range(n_per):
            out.append((mu_x + rng.gauss(0, sigma_mm),
                        rng.gauss(0, sigma_mm), d))
    return out


def test_trend_recovers_growth_and_bias():
    """Wide span + lots of data → k and the bias line are recovered, and the
    well-resolved growth overrides the population prior."""
    s = _make_samples([18, 30, 50, 70], 800,
                      a_mm=12.0, b_mrad=1.5, s0_mrad=2.0, k=0.010, seed=7)
    tr = apollo._fit_angular_trend(s)['trend']
    assert tr['ok']
    assert abs(tr['growth_k'] - 0.010) < 0.003
    mm = tr['mean_mm']
    assert abs(mm['ax'] - 12.0) < 6.0
    assert abs(mm['bx'] - 1.5) < 0.5
    assert abs(mm['ay']) < 6.0          # no y bias in the data


def test_flat_data_resolves_k_below_prior():
    """Truly flat dispersion with ample data → k is resolved near 0 and the
    near-zero bias intercept shrinks away."""
    s = _make_samples([18, 30, 50], 500,
                      a_mm=0.0, b_mrad=2.0, s0_mrad=4.0, k=0.0, seed=3)
    tr = apollo._fit_angular_trend(s)['trend']
    assert tr['ok']
    assert tr['growth_k'] < KD          # pulled below the population prior
    assert abs(tr['growth_k']) < 0.004
    assert abs(tr['mean_mm']['ax']) < 6.0


def test_sparse_data_shrinks_k_toward_prior():
    """Two distances at the minimum hit count → k is poorly resolved, so it
    stays near the handicap population prior rather than the data's ~0."""
    s = _make_samples([18, 50], apollo._PREDICT_TREND_MIN_PER_DIST,
                      a_mm=0.0, b_mrad=2.0, s0_mrad=4.0, k=0.0, seed=5)
    tr = apollo._fit_angular_trend(s)['trend']
    assert tr['ok']
    assert tr['growth_k'] > 0.5 * KD


def test_single_distance_matches_legacy_flat():
    """One distance → no trend, and the flat fit reproduces the legacy pooled
    mean/covariance exactly (regression guard)."""
    s = _make_samples([30], 200,
                      a_mm=5.0, b_mrad=2.0, s0_mrad=4.0, k=0.0, seed=9)
    fit = apollo._fit_angular_trend(s)
    assert fit['trend']['ok'] is False

    xs = [x / d for (x, y, d) in s]
    ys = [y / d for (x, y, d) in s]
    n = len(s)
    mx, my = sum(xs) / n, sum(ys) / n
    vxx = sum((x - mx) ** 2 for x in xs) / (n - 1)
    vyy = sum((y - my) ** 2 for y in ys) / (n - 1)
    assert abs(fit['mean_mrad'][0] - mx) < 1e-9
    assert abs(fit['mean_mrad'][1] - my) < 1e-9
    assert abs(fit['cov_mrad'][0][0] - vxx) < 1e-9
    assert abs(fit['cov_mrad'][1][1] - vyy) < 1e-9


def test_diagnostic_flags_real_spread_difference():
    """A genuinely 3× wider group at 50 m → the per-distance diagnostic flags
    the spread difference as significant."""
    s = (_make_samples([18], 300, 0.0, 0.0, 3.0, 0.0, seed=1)
         + _make_samples([50], 300, 0.0, 0.0, 9.0, 0.0, seed=2))
    pd = {row['d']: row for row in apollo._fit_angular_trend(s)['per_distance']}
    assert pd[50.0]['spread_p'] is not None and pd[50.0]['spread_p'] < 0.05
    assert pd[50.0]['spread_ratio'] > 1.3


def test_thin_distance_has_no_spurious_significance():
    """A distance with <3 shots must not report bias/spread p-values — its
    within-group deviation collapses to ~0 and would fire spuriously."""
    s = (_make_samples([18], 60, 0.0, 0.0, 3.0, 0.0, seed=1)
         + _make_samples([50], 1, 0.0, 0.0, 3.0, 0.0, seed=2))
    pd = {row['d']: row for row in apollo._fit_angular_trend(s)['per_distance']}
    assert pd[50.0]['n'] == 1
    assert pd[50.0]['bias_p'] is None
    assert pd[50.0]['spread_p'] is None


def test_scorecard_rows_are_detected_by_match_tag():
    """Scorecard rows store synthetic ring-midpoint coords and must be kept
    out of the fit. Both competition score sheets and paper practice
    scorecards carry a ``match:`` tag; plotted sessions never do."""
    f = apollo._predict_row_is_scorecard
    # Competition score sheet.
    assert f('tournament:wa720, match:42, participant:Robin') is True
    # Paper practice scorecard (also carries match: via the shared plumbing).
    assert f('tournament:wa720, practice, practice_scorecard, match:7') is True
    # Plotted sessions — tournament or practice — have no match: tag.
    assert f('tournament:wa720') is False
    assert f('practice') is False
    assert f('') is False
    assert f(None) is False


def test_model_expected_ppa_sane_and_monotonic():
    """`_model_expected_ppa` — the server-side mirror of the sim's per-arrow
    scoring, which the global Fuzzy Factor divides into — returns a plausible
    points/arrow, a tighter group scores higher than a looser one on the same
    face, and a miss rate drags it down. Pure math, no DB."""
    zones = [{'radius_mm': 20 * (i + 1), 'point_value': 10 - i} for i in range(10)]
    tight = {'ok': True, 'mean_mrad': [0.0, 0.0],
             'cov_mrad': [[1.0, 0.0], [0.0, 1.0]], 'trend': None,
             'miss_rate': 0.0, 'shaft_mm': 6.0}
    loose = dict(tight, cov_mrad=[[9.0, 0.0], [0.0, 9.0]])
    ppa_tight = apollo._model_expected_ppa(tight, 18.0, zones, n_samples=8000)
    ppa_loose = apollo._model_expected_ppa(loose, 18.0, zones, n_samples=8000)
    assert 0 < ppa_loose < ppa_tight <= 10
    # A 50% miss rate roughly halves the expectation.
    missy = dict(tight, miss_rate=0.5)
    ppa_missy = apollo._model_expected_ppa(missy, 18.0, zones, n_samples=8000)
    assert ppa_missy < ppa_tight
    # Degenerate inputs return None rather than raising.
    assert apollo._model_expected_ppa(tight, 0, zones) is None
    assert apollo._model_expected_ppa(tight, 18.0, []) is None


if __name__ == '__main__':
    for name, fn in sorted(globals().items()):
        if name.startswith('test_') and callable(fn):
            fn()
            print(f'ok  {name}')
    print('all passed')
