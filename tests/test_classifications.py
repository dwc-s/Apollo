"""Unit tests for classification resolvers."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import classifications as cls
from classifications import Category


REC_SM = Category("recurve", "male", "adult")       # recurve senior male
REC_SF = Category("recurve", "female", "adult")     # recurve senior female


def test_agb_outdoor_datum_is_master_bowman():
    # Recurve senior male: MB threshold == datum_out (30), GMB one step better,
    # B1 one step worse (classStep_out = 7).
    th = {c: hc for c, _, _, hc in cls.agb_class_thresholds(REC_SM, indoor=False)}
    assert th["MB"] == 30
    assert th["GMB"] == 30 - 7
    assert th["EMB"] == 30 - 14
    assert th["B1"] == 30 + 7
    assert th["A3"] == 30 + 6 * 7


def test_agb_indoor_datum_is_master_bowman():
    th = {c: hc for c, _, _, hc in cls.agb_class_thresholds(REC_SM, indoor=True)}
    # Indoor recurve: datum_in = 28, classStep_in = 7.5, I-MB is datum.
    assert th["I-MB"] == 28
    assert th["I-GMB"] == 28 - 7.5
    assert th["I-B1"] == 28 + 7.5


def test_female_thresholds_are_higher_than_male():
    male = {c: hc for c, _, _, hc in cls.agb_class_thresholds(REC_SM, indoor=False)}
    female = {c: hc for c, _, _, hc in cls.agb_class_thresholds(REC_SF, indoor=False)}
    # Female gets a gender step added (worse handicap for same class), so the
    # qualifying handicap threshold is numerically larger.
    assert female["MB"] == male["MB"] + 5  # genderStep_out = 5


def test_agb_classification_boundary_flips():
    # A handicap exactly at B1's threshold earns B1; one worse drops to B2.
    th = {c: hc for c, _, _, hc in cls.agb_class_thresholds(REC_SM, indoor=False)}
    b1 = th["B1"]
    at = cls.agb_classification("wa_720_recurve", b1, REC_SM)
    just_over = cls.agb_classification("wa_720_recurve", b1 + 0.001, REC_SM)
    assert at["code"] == "B1"
    assert just_over["code"] == "B2"


def test_agb_only_for_eligible_rounds():
    assert cls.agb_classification("nfaa_field_28", 30, REC_SM) is None
    assert cls.agb_classification("wa_720_recurve", 30, REC_SM)["code"] == "MB"


def test_master_bowman_tier_flagged_record_status():
    gmb = cls.agb_classification("wa_720_recurve", 10, REC_SM)
    assert gmb["record_status"] is True
    a1 = cls.agb_classification("wa_720_recurve", 55, REC_SM)
    assert a1["record_status"] is False


def test_wa_star_award_thresholds():
    assert cls.wa_star_award("wa_1440_recurve_m", 1400)["name"] == "Purple Star"
    assert cls.wa_star_award("wa_1440_recurve_m", 1399)["name"] == "Gold Star"
    assert cls.wa_star_award("wa_1440_recurve_m", 1000)["name"] == "White Star"
    assert cls.wa_star_award("wa_1440_recurve_m", 999) is None
    # Not a 1440 round → no star award.
    assert cls.wa_star_award("wa_720_recurve", 700) is None


def test_usaa_award_pins():
    assert cls.usaa_award("wa_1440_compound_m", 1305)["name"] == "1300 Pin"
    assert cls.usaa_award("wa_1440_compound_m", 1000)["name"] == "1000 Pin"
    assert cls.usaa_award("wa_1440_compound_m", 999) is None


def test_resolve_awards_combines_schemes():
    awards = cls.resolve_awards("wa_1440_recurve_m", 1410, 5, REC_SM)
    schemes = {a["scheme"] for a in awards}
    assert "World Archery" in schemes
    assert "USA Archery" in schemes
    assert "Archery GB" in schemes
