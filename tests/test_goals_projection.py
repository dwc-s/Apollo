"""Unit tests for the goal-projection helper (apollo._project_handicap) and the
weather-band bucketing (apollo._band_of).

_project_handicap is pure: given a list of completed-round handicap points and a
deadline, it fits the same least-squares line the handicap-trend report draws
and grades progress toward a target (lower handicap = better). No Flask/DB
beyond importing the module.
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo


def _pts(*pairs):
    """Build sorted points from (days_from_epoch, handicap) pairs."""
    base = datetime(2026, 1, 1)
    pts = [{'date': base + timedelta(days=d), 'handicap': h} for d, h in pairs]
    pts.sort(key=lambda p: p['date'])
    return pts


DEADLINE = datetime(2026, 1, 1) + timedelta(days=200)


def test_empty_is_no_data():
    r = apollo._project_handicap([], DEADLINE, target_handicap=30)
    assert r['verdict'] == 'no_data'
    assert r['latest'] is None


def test_single_round_has_no_trend():
    r = apollo._project_handicap(_pts((0, 40)), DEADLINE, target_handicap=30)
    assert r['verdict'] == 'no_trend'
    assert r['latest'] == 40
    assert r['slope_per_year'] is None


def test_already_met_is_achieved():
    # latest 28 is already <= target 30 (lower is better).
    r = apollo._project_handicap(_pts((0, 34), (30, 28)), DEADLINE, target_handicap=30)
    assert r['verdict'] == 'achieved'


def test_improving_reaches_target_is_on_track():
    # Steep improvement 48 -> 34 over 90 days; extrapolated well below 30 by day 200.
    r = apollo._project_handicap(
        _pts((0, 48), (30, 44), (60, 39), (90, 34)), DEADLINE, target_handicap=30)
    assert r['verdict'] == 'on_track'
    assert r['slope_per_year'] < 0            # improving = negative slope
    assert r['projected'] <= 30


def test_improving_too_slowly_is_behind():
    # Gentle improvement that won't reach the target by the deadline.
    r = apollo._project_handicap(
        _pts((0, 50), (60, 49), (120, 48)), DEADLINE, target_handicap=30)
    assert r['verdict'] == 'behind'
    assert r['projected'] > 30


def test_worsening_is_behind():
    r = apollo._project_handicap(
        _pts((0, 30), (30, 33), (60, 36)), DEADLINE, target_handicap=25)
    assert r['verdict'] == 'behind'
    assert r['slope_per_year'] > 0            # getting worse


def test_no_deadline_uses_trend_direction():
    improving = apollo._project_handicap(_pts((0, 45), (60, 38)), None,
                                         target_handicap=20)
    assert improving['verdict'] == 'on_track'
    worsening = apollo._project_handicap(_pts((0, 30), (60, 37)), None,
                                         target_handicap=20)
    assert worsening['verdict'] == 'behind'


def test_required_rate_reported_with_deadline():
    r = apollo._project_handicap(_pts((0, 50), (30, 46)), DEADLINE,
                                 target_handicap=30)
    # Needs to drop from 46 to 30 -> negative required rate per year.
    assert r['required_per_year'] is not None
    assert r['required_per_year'] < 0


def test_wind_band_bucketing():
    labels = [b[0] for b in apollo._WIND_BANDS]
    assert apollo._band_of(0, apollo._WIND_BANDS) == labels[0]      # calm
    assert apollo._band_of(7.9, apollo._WIND_BANDS) == labels[0]
    assert apollo._band_of(8, apollo._WIND_BANDS) == labels[1]      # light
    assert apollo._band_of(25, apollo._WIND_BANDS) == labels[2]     # moderate
    assert apollo._band_of(40, apollo._WIND_BANDS) == labels[3]     # strong
    assert apollo._band_of(None, apollo._WIND_BANDS) is None
