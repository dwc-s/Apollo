"""Unit tests for the handicap-trend headline figures (apollo._handicap_summary).

Pure-aggregation tests: given a list of completed-round handicaps with dates,
check the three headline numbers — latest, best-of-recent, and the AGB official
figure (average of the best three, rounded DOWN per the 2023 scheme). No
Flask/DB beyond importing the module.
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo


def _pts(*pairs):
    """Build sorted points from (iso_date, handicap) pairs."""
    pts = [{'date': datetime.fromisoformat(d), 'handicap': h} for d, h in pairs]
    pts.sort(key=lambda p: p['date'])
    return pts


def test_empty():
    s = apollo._handicap_summary([])
    assert s == {'latest': None, 'best_recent': None,
                 'agb': None, 'agb_basis': None}


def test_latest_is_most_recent_by_date():
    # Out-of-order input; latest must follow the newest date, not list order.
    s = apollo._handicap_summary(_pts(
        ('2026-05-01', 50), ('2026-01-01', 70), ('2026-03-01', 60)))
    assert s['latest'] == 50


def test_agb_average_of_best_three_rounded_down():
    # Best three handicaps 63, 69, 70 → 202/3 = 67.33 → floor 67 (round down).
    s = apollo._handicap_summary(_pts(
        ('2026-01-10', 70), ('2026-02-10', 69), ('2026-03-10', 80),
        ('2026-04-10', 63)))
    assert s['agb'] == 67
    assert s['agb_basis'] == 'season 2026'


def test_agb_needs_three_rounds():
    s = apollo._handicap_summary(_pts(('2026-01-10', 55), ('2026-02-10', 50)))
    assert s['agb'] is None
    assert s['agb_basis'] is None


def test_best_recent_is_lowest_in_trailing_year():
    # The 40 is >12 months before the latest round, so it must not count.
    s = apollo._handicap_summary(_pts(
        ('2024-01-01', 40), ('2026-01-01', 62), ('2026-06-01', 55)))
    assert s['best_recent'] == 55


def test_agb_falls_back_when_season_thin():
    # Only two rounds in the latest year (2026) but three within 12 months,
    # so the figure comes from the trailing-12-months pool, flagged provisional.
    s = apollo._handicap_summary(_pts(
        ('2025-08-01', 60), ('2026-01-01', 66), ('2026-06-01', 63)))
    # best three of {60, 66, 63} = all → 189/3 = 63.
    assert s['agb'] == 63
    assert s['agb_basis'] == 'last 12 months (provisional)'
