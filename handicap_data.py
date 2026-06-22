"""Static reference data for classifications (AGB, World Archery, USA Archery).

Kept separate from the math (``handicap.py``) and the resolver logic
(``classifications.py``) so the published constants are easy to audit against
their sources.

Sources
-------
* **AGB 2023 classification thresholds** — derived by formula from the bowstyle
  datum/step constants used by the MIT-licensed ``archeryutils`` reference
  (``AGB_bowstyles.json`` / ``AGB_ages.json``); cross-checked against
  archerycalculator.co.uk. Each classification's threshold *handicap* is::

      outdoor:  datum_out + (class_index - 2) * classStep_out + age_gender_step
      indoor:   datum_in  + (class_index - 1) * classStep_in  + age_gender_step

  where ``age_gender_step`` follows AGB's age/gender alignment rule (see
  ``classifications.agb_age_gender_step``).
* **World Archery Star Awards** — fixed point milestones on the 1440 round
  (worldarchery.sport badge-awards).
* **USA Archery** — the World Archery Performance Awards as administered in the
  US (usarchery.org): the same 1440 milestones, pin levels 1000–1300.

NFAA classification is intentionally **not** here: it is a relative,
multi-score handicap (deferred to a later version).
"""

# ── AGB bowstyle datum/step constants (outdoor target + indoor target) ─────
# Values lifted from archeryutils' AGB_bowstyles.json (2023 scheme).
AGB_BOWSTYLES = {
    "compound": {"datum_out": 15, "classStep_out": 6, "genderStep_out": 4, "ageStep_out": 6,
                 "datum_in": 11, "classStep_in": 8, "genderStep_in": 4, "ageStep_in": 6},
    "recurve":  {"datum_out": 30, "classStep_out": 7, "genderStep_out": 5, "ageStep_out": 6.5,
                 "datum_in": 28, "classStep_in": 7.5, "genderStep_in": 5, "ageStep_in": 6.5},
    "barebow":  {"datum_out": 47, "classStep_out": 5.5, "genderStep_out": 5.5, "ageStep_out": 5.5,
                 "datum_in": 42, "classStep_in": 6.0, "genderStep_in": 5.5, "ageStep_in": 5.5},
    "longbow":  {"datum_out": 65, "classStep_out": 6, "genderStep_out": 7, "ageStep_out": 6,
                 "datum_in": 61, "classStep_in": 6.5, "genderStep_in": 7, "ageStep_in": 6},
    "traditional": {"datum_out": 47, "classStep_out": 5.5, "genderStep_out": 5.5, "ageStep_out": 5.5,
                    "datum_in": 42, "classStep_in": 6.0, "genderStep_in": 5.5, "ageStep_in": 5.5},
    "flatbow":  {"datum_out": 47, "classStep_out": 5.5, "genderStep_out": 5.5, "ageStep_out": 5.5,
                 "datum_in": 42, "classStep_in": 6.0, "genderStep_in": 5.5, "ageStep_in": 5.5},
}

# age_group -> age category step (number of age steps below Adult).
AGB_AGE_STEP = {
    "adult": 0,
    "50+": 1,
    "under 21": 1,
    "under 18": 2,
    "under 16": 3,
    "under 15": 4,
    "under 14": 5,
    "under 12": 6,
}

# Outdoor target classes, best → worst. MB-tier (first three) are awarded only
# at record-status events; Apollo shows them informationally.
AGB_CLASSES_OUT = [
    ("EMB", "Elite Master Bowman", True),
    ("GMB", "Grand Master Bowman", True),
    ("MB", "Master Bowman", True),
    ("B1", "Bowman 1st Class", False),
    ("B2", "Bowman 2nd Class", False),
    ("B3", "Bowman 3rd Class", False),
    ("A1", "Archer 1st Class", False),
    ("A2", "Archer 2nd Class", False),
    ("A3", "Archer 3rd Class", False),
]

# Indoor target classes, best → worst (no Elite tier indoors).
AGB_CLASSES_IN = [
    ("I-GMB", "Indoor Grand Master Bowman", True),
    ("I-MB", "Indoor Master Bowman", True),
    ("I-B1", "Indoor Bowman 1st Class", False),
    ("I-B2", "Indoor Bowman 2nd Class", False),
    ("I-B3", "Indoor Bowman 3rd Class", False),
    ("I-A1", "Indoor Archer 1st Class", False),
    ("I-A2", "Indoor Archer 2nd Class", False),
    ("I-A3", "Indoor Archer 3rd Class", False),
]

# ── World Archery Star Awards (1440 round), best → worst by point milestone ─
WA_STAR_AWARDS = [
    (1400, "Purple Star"),
    (1350, "Gold Star"),
    (1300, "Red Star"),
    (1200, "Blue Star"),
    (1100, "Black Star"),
    (1000, "White Star"),
]

# ── USA Archery — World Archery Performance Award pins (1440), best → worst ─
USAA_AWARDS = [
    (1300, "1300 Pin"),
    (1200, "1200 Pin"),
    (1100, "1100 Pin"),
    (1000, "1000 Pin"),
]

# ── USA Archery Collegiate Minimum Qualifying Scores ────────────────────────
# The only real-world, percentile-grounded benchmark either WA or USAA
# publishes: the collegiate MQS are set at the 60th percentile of national
# scores (per USA Archery's collegiate awards page). One score per round per
# gender — a single percentile point, NOT a full distribution (no governing
# body publishes P10/P50/P90 per round). Used by the /predict histogram to
# mark "where the 60th-percentile collegiate archer lands" on the same round.
#   Source: usarchery.org/participate/collegiate/collegiate-awards (60th pct;
#   outdoor adjusted to 72 arrows, indoor 60 arrows — matches Apollo's rounds).
# Keyed by Apollo round_key → {gender: score}. Recurve/compound 720 (70/50 m)
# and WA Indoor 18 m only; other rounds have no published collegiate MQS.
USAA_COLLEGIATE_MQS = {
    'wa_720_recurve':        {'male': 570, 'female': 520},
    'wa_720_compound':       {'male': 630, 'female': 600},
    'wa_indoor_18_recurve':  {'male': 302, 'female': 296},
    'wa_indoor_18_compound': {'male': 346, 'female': 329},
}

# ── Apollo round metadata ──────────────────────────────────────────────────
# Rounds shot indoors: use the scheme-standard 9.3 mm arrow for the handicap
# model and the AGB *indoor* classification scheme.
INDOOR_ROUNDS = {
    "wa_indoor_18_recurve", "wa_indoor_18_compound", "wa_indoor_25",
    "nfaa_indoor_blue", "nfaa_5spot", "nfaa_vegas",
    "usaa_indoor_nationals", "usaa_collegiate_indoor", "usaa_joad_indoor",
}

# WA / USAA 1440 rounds eligible for star / performance awards.
WA_1440_ROUNDS = {
    "wa_1440_recurve_m", "wa_1440_recurve_w",
    "wa_1440_compound_m", "wa_1440_compound_w",
}

# WA target rounds AGB classifies. Outdoor target (720 / 1440) and indoor
# target (18 m / 25 m). The USAA mirrors are the same WA rounds. NFAA rounds,
# match formats, and WA Field are excluded (field uses a separate AGB scheme,
# deferred). Indoor membership is taken from INDOOR_ROUNDS above.
AGB_TARGET_ROUNDS = {
    "wa_720_recurve", "wa_720_compound",
    "wa_1440_recurve_m", "wa_1440_recurve_w",
    "wa_1440_compound_m", "wa_1440_compound_w",
    "wa_indoor_18_recurve", "wa_indoor_18_compound", "wa_indoor_25",
    "usaa_outdoor_nationals_recurve", "usaa_outdoor_nationals_compound",
    "usaa_collegiate_outdoor_recurve", "usaa_collegiate_outdoor_compound",
    "usaa_indoor_nationals", "usaa_collegiate_indoor", "usaa_joad_indoor",
}
