"""Classification resolvers: Archery GB, World Archery, USA Archery.

Given a completed round (its key + raw score), the archer's AGB *handicap* for
that score, and the archer's category (bowstyle / gender / age group), return
the awards earned under each scheme. Pure functions — no Flask/DB.

* **AGB** — formula-derived handicap thresholds per class (see ``handicap_data``).
  A class is met when the achieved handicap is at or below its threshold. The
  Master Bowman tier is flagged ``record_status`` because officially it is
  awarded only at record-status events; Apollo shows it for information.
* **World Archery** — Star Awards on the 1440 round (fixed point milestones).
* **USA Archery** — World Archery Performance Award pins on the 1440.

NFAA is deferred to a later version (it is a relative, multi-score handicap,
not a single-round lookup).
"""

from __future__ import annotations

from dataclasses import dataclass

import handicap_data as data


@dataclass(frozen=True)
class Category:
    """An archer's classification category."""

    bowstyle: str = "recurve"   # recurve | compound | barebow | longbow | ...
    gender: str = "male"        # male | female | open  (open == male thresholds)
    age_group: str = "adult"    # adult | 50+ | under 21 | under 18 | ...

    def normalized(self) -> "Category":
        bow = (self.bowstyle or "recurve").strip().lower()
        gen = (self.gender or "male").strip().lower()
        age = (self.age_group or "adult").strip().lower()
        if bow not in data.AGB_BOWSTYLES:
            bow = "recurve"
        if gen not in ("male", "female", "open"):
            gen = "male"
        if age not in data.AGB_AGE_STEP:
            age = "adult"
        return Category(bow, gen, age)


def agb_age_gender_step(gender: str, age_cat: int, age_step: float, gender_step: float) -> float:
    """AGB age + gender handicap offset relative to the MB datum.

    Ported from archeryutils ``get_age_gender_step`` — includes the U16
    alignment fiddle that prevents the gender step overtaking the age step.
    """
    female = gender == "female"
    under_16 = 3
    if female and age_cat == under_16 and age_step < gender_step:
        return age_cat * age_step + age_step
    if female and age_cat <= under_16:
        return gender_step + age_cat * age_step
    return age_cat * age_step


def agb_class_thresholds(category: Category, indoor: bool):
    """Threshold handicaps for every AGB class in the category, best → worst.

    Returns a list of ``(code, long_name, record_status, threshold_hc)``.
    """
    category = category.normalized()
    bs = data.AGB_BOWSTYLES[category.bowstyle]
    age_cat = data.AGB_AGE_STEP[category.age_group]
    classes = data.AGB_CLASSES_IN if indoor else data.AGB_CLASSES_OUT

    if indoor:
        datum, class_step = bs["datum_in"], bs["classStep_in"]
        age_step, gender_step = bs["ageStep_in"], bs["genderStep_in"]
        index_offset = 1   # I-MB is the datum
    else:
        datum, class_step = bs["datum_out"], bs["classStep_out"]
        age_step, gender_step = bs["ageStep_out"], bs["genderStep_out"]
        index_offset = 2   # MB is the datum

    delta = agb_age_gender_step(category.gender, age_cat, age_step, gender_step)

    out = []
    for i, (code, long_name, record) in enumerate(classes):
        threshold = datum + (i - index_offset) * class_step + delta
        out.append((code, long_name, record, threshold))
    return out


def agb_classification(round_key: str, handicap, category: Category):
    """Best AGB class earned by ``handicap`` on ``round_key``, or ``None``.

    Returns a dict ``{scheme, code, name, record_status}`` for the highest
    class whose threshold the handicap meets (lower handicap = better), or
    ``None`` if the round is not AGB-classified or the score is below the
    lowest class.
    """
    if handicap is None or round_key not in data.AGB_TARGET_ROUNDS:
        return None
    indoor = round_key in data.INDOOR_ROUNDS
    thresholds = agb_class_thresholds(category, indoor)
    # Classes are ordered best → worst with increasing threshold handicaps;
    # the best class met is the first whose threshold the handicap satisfies.
    for code, long_name, record, threshold in thresholds:
        if handicap <= threshold:
            return {
                "scheme": "Archery GB",
                "code": code,
                "name": long_name,
                "record_status": record,
            }
    return None


def _best_milestone(table, score):
    for threshold, name in table:   # tables are ordered best → worst
        if score >= threshold:
            return threshold, name
    return None


def wa_star_award(round_key: str, score):
    """World Archery Star Award for a 1440 score, or ``None``."""
    if score is None or round_key not in data.WA_1440_ROUNDS:
        return None
    hit = _best_milestone(data.WA_STAR_AWARDS, score)
    if not hit:
        return None
    threshold, name = hit
    return {"scheme": "World Archery", "code": str(threshold), "name": name,
            "record_status": threshold >= 1350}


def usaa_award(round_key: str, score):
    """USA Archery World Archery Performance Award pin for a 1440, or ``None``."""
    if score is None or round_key not in data.WA_1440_ROUNDS:
        return None
    hit = _best_milestone(data.USAA_AWARDS, score)
    if not hit:
        return None
    threshold, name = hit
    return {"scheme": "USA Archery", "code": str(threshold), "name": name,
            "record_status": False}


def resolve_awards(round_key: str, score, handicap, category: Category):
    """All classification awards across schemes for a completed round.

    Returns a list of award dicts (possibly empty).
    """
    awards = []
    for resolver in (agb_classification(round_key, handicap, category),
                     wa_star_award(round_key, score),
                     usaa_award(round_key, score)):
        if resolver:
            awards.append(resolver)
    return awards
