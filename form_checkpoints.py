"""Biomechanical form checkpoints for the motion-capture analyzer.

Apollo's `/form` page extracts a skeleton from video *in the browser* (markerless
pose estimation) and scores the archer's body position against the established
coaching checkpoints for their bowstyle — "the line", level shoulders, draw-elbow
alignment, anchor, follow-through. This module is the **reference spec**: the
single source of truth for *what good form is* (target angles + tolerance bands +
coaching tips), keyed by bowstyle.

Source of the "proper form" definitions
----------------------------------------
The targets, tolerances, and coaching cues below are grounded in USA Archery's
**BEST method** (Biomechanically Efficient Shooting Technique) — the USA Archery
Coach Development Committee's biomechanically-derived standard for recurve form.
Page references in the checkpoint comments point at the BEST handbook. The
principles we encode (every one observable from a single rear/side camera):

* Draw elbow in line with the arrow at full draw, level with or *slightly above*
  the line — never below; "avoid triangulation in either plane" (BEST p.4, 9, 10).
* Both the draw and bow shoulders set *down* — "raise the bow and arms, not the
  shoulders"; the acromial notch marks correct bow-shoulder extension (p.4, 5, 8).
* A flat, vertical back with the centre of gravity over the feet — *not* an
  arched or backward lean (p.4, 8).
* Head in a natural vertical position, turned to the target without tilting;
  "bring the string to the head, not the head to the string" (p.4, 9).
* A solid, bone-to-bone anchor, identical every shot (p.9). NB the BEST handbook
  is a recurve document — its under-jaw anchor is recurve-specific. Barebow
  anchors high (index finger at the corner of the mouth), compound behind the
  jaw with a release, traditional high/instinctive — so the anchor checkpoint's
  guidance is overridden per bowstyle while the "is it in solid, repeatable
  contact?" measure stays shared.
* A follow-through where the draw hand recoils straight back along the neck, in
  the same plane as the arrow — a pluck shows here (p.11).

BEST principles that need force/pressure sensing rather than pose — foot weight
(~70% on the balls of the feet), finger-pressure split, the 45° grip, internal
back-tension transfer — are out of scope for a camera-only analyzer and are not
scored here.

Design notes
------------
* **Reference, not learner.** These are fixed, explainable rules — not a model
  trained on user data. A user's poor form can never alter the reference, which
  is exactly the learning/analysis separation the feature calls for. The
  dev/admin "learning" flow (capture a known-good archer) is only ever used to
  *author/tune* the numbers below; it is not online learning.
* **Pure module.** No Flask, no DB, no import of ``apollo`` — like ``handicap.py``
  and ``classifications.py``. ``apollo`` imports ``checkpoints_for`` and serves
  the result to the client as JSON.
* **Geometry-agnostic here.** This module only declares *targets and tolerances*.
  The actual angle measurement from pose landmarks lives in
  ``static/apollo-form.js`` (it needs the live keypoints). Each checkpoint names a
  ``measure`` key; the JS has a matching pure function. Targets are kept here so
  tuning form never means touching JS.

Checkpoint schema
-----------------
Each checkpoint is a dict::

    id        unique key (stable; used as the JSON/score key)
    label     human label shown in the feedback panel
    frame     'anchor' | 'follow_through' — which captured key-frame it scores
    measure   name of the JS measurement function that produces a scalar (degrees)
    unit      display unit (always '°' for v1; kept for future ratios)
    target    ideal value
    warn      |measured - target| at/under this is a PASS; over it is a WARN
    fail      |measured - target| over this is a FAIL (between warn and fail = WARN)
    warn_low  (optional) low-side PASS band, used only when a signed measure
              reads below ``target``; defaults to ``warn``
    fail_low  (optional) low-side FAIL band, paired with ``warn_low``; → ``fail``
    view      'rear' | 'side' — recommended camera placement for this checkpoint
    tip       coaching cue shown when the checkpoint isn't a clean PASS

``warn``/``fail`` are half-width tolerance bands around ``target`` (symmetric).
A checkpoint may also declare ``warn_low``/``fail_low``: tighter bands the JS
scorer applies when a *signed* measure reads below its target — so one direction
is flagged sooner than the other (e.g. the draw elbow dipping below the arrow
line is a fault, while sitting slightly above it is fine). Absent those, the
band stays symmetric.

Angles that wrap (e.g. an alignment that is ideally 180°) are compared with the
circular difference in the JS scorer, so a 175° vs 185° read both score as a 5°
deviation rather than 10° vs 350°.
"""

from __future__ import annotations

import copy

# Bowstyles that share recurve-like form (open-finger release, conscious
# expansion, defined anchor). Barebow differs mainly in anchor/aiming, handled
# via overrides below.
_RECURVE_LIKE = ('recurve', 'barebow')
_TRAD_LIKE = ('longbow', 'traditional', 'flatbow')


# ── Base checkpoint set ────────────────────────────────────────────────────
# Tuned to a right- or left-handed archer shot from *behind the shooting line*
# (the recommended v1 view) unless ``view`` says 'side'. The JS resolves the
# "bow side" / "draw side" landmarks from the archer's handedness, so the spec
# is stated abstractly and never bakes in a left/right.
_BASE_CHECKPOINTS = [
    {
        # BEST p.4/9/10: the tip of the drawing elbow is in line with the arrow
        # at full draw (seen from side AND behind), the forearm "even with or
        # slightly below the line of the anchor", elbow "level with or only
        # slightly above the line of the arrow" — and "avoid triangulation in
        # either the vertical or horizontal plane". A SIGNED measure: elbow
        # elevation above (+) / below (−) the arrow line, target 0. Because "above"
        # is tolerable but "below" is a fault, the bands are asymmetric — the
        # low-side warn/fail bite far sooner than the (generous) high side.
        'id': 'draw_elbow_elevation',
        'label': 'Draw elbow in line',
        'frame': 'anchor',
        'measure': 'draw_elbow_elevation',
        'unit': '°',
        'target': 0.0, 'warn': 10.0, 'fail': 22.0,
        'warn_low': 3.0, 'fail_low': 10.0,
        'view': 'rear',
        'tip': 'Put the drawing forearm in line with the arrow — the elbow tip '
               'level with, or only slightly above, the arrow line (never below). '
               'Bring it round behind the arrow; avoid bending the line into a '
               'triangle (BEST method).',
    },
    {
        # BEST p.4/8: both shoulders set down, "no hunching or slouching";
        # raise the arms and bow without raising the shoulders.
        'id': 'shoulder_level',
        'label': 'Level shoulders',
        'frame': 'anchor',
        'measure': 'shoulder_level',
        'unit': '°',
        'target': 0.0, 'warn': 5.0, 'fail': 12.0,
        'view': 'rear',
        'tip': 'Set both shoulders down and keep the shoulder line level. Raise '
               'the bow and arms into position without raising the shoulders — a '
               'lifted bow shoulder means the arm, not the back, is doing the work.',
    },
    {
        # BEST p.4/5: bow shoulder kept low; "raise only the bow arm and bow,
        # not the shoulder". Correct extension shows as the acromial notch.
        'id': 'bow_shoulder_set',
        'label': 'Bow shoulder down',
        'frame': 'anchor',
        'measure': 'bow_shoulder_shrug',
        'unit': '°',
        'target': 0.0, 'warn': 8.0, 'fail': 18.0,
        'view': 'rear',
        'tip': 'Set the bow shoulder down and in, reaching for the target from '
               'underneath the arm — look for the acromial notch (the dip on top '
               'of the shoulder). A shrugged shoulder collapses under load.',
    },
    {
        # BEST p.5/10: bow arm strong, fully extended, "reaching toward the
        # target"; the bow-arm shoulder extends toward the target at full draw.
        'id': 'bow_arm_elevation',
        'label': 'Bow arm to target',
        'frame': 'anchor',
        'measure': 'bow_arm_elevation',
        'unit': '°',
        'target': 0.0, 'warn': 6.0, 'fail': 15.0,
        'view': 'side',
        'tip': 'Reach the bow arm flat toward the target and keep it strong and '
               'still — extend toward the target rather than dropping or hiking '
               'the arm to aim.',
    },
    {
        # BEST p.4/8: a flat, vertical back with the pelvis tucked and the COG
        # over the feet — "avoid the deep curvature"/arching and leaning back.
        # Near-vertical, hence a small target rather than a deliberate lean.
        'id': 'spine_posture',
        'label': 'Flat, upright back',
        'frame': 'anchor',
        'measure': 'spine_lean',
        'unit': '°',
        'target': 3.0, 'warn': 5.0, 'fail': 12.0,
        'view': 'side',
        'tip': 'Stand tall with a flat back and weight forward on the balls of '
               'the feet — tuck the hips slightly. Don\'t arch the back or lean '
               'back into the bow; that loses your line of strength.',
    },
    {
        # BEST p.4/9: head in a "natural vertical position", turned to the target
        # "without tilting"; keep it still — bring the string to the head.
        'id': 'head_position',
        'label': 'Head upright',
        'frame': 'anchor',
        'measure': 'head_tilt',
        'unit': '°',
        'target': 0.0, 'warn': 7.0, 'fail': 16.0,
        'view': 'rear',
        'tip': 'Bring the string to your head, not your head to the string. Hold '
               'the head level and turned squarely at the target so you are not '
               'looking from the corner of your eye, and keep it still through the draw.',
    },
    {
        # Gap from the draw hand to the face, as a percentage of shoulder width
        # (scale-free, so it works at any camera distance). A firm anchor sits
        # the hand against the face — a small gap; a floating anchor reads large.
        # Not an angle, hence the '%' unit; the scorer is unit-agnostic.
        #
        # The measure is style-agnostic (is the hand in solid contact?), but the
        # ANCHOR LOCATION is not: the base tip below is the Olympic-recurve
        # under-jaw anchor from the BEST handbook (a recurve document). Barebow,
        # compound and traditional anchor elsewhere and get their own tips via
        # the per-bowstyle overrides further down.
        'id': 'anchor_contact',
        'label': 'Solid anchor',
        'frame': 'anchor',
        'measure': 'anchor_hand_to_face',
        'unit': '%',
        'target': 18.0, 'warn': 12.0, 'fail': 25.0,
        'view': 'rear',
        'tip': 'For Olympic recurve, anchor the hand bone-to-bone under the jaw '
               'with the string touching the centre of the chin and the tip of '
               'the nose — the same touch point every shot (BEST). A floating '
               'anchor scatters the group.',
    },
    {
        # Hold steadiness — the float at full draw, measured over the whole hold
        # window (not one frame) as the RMS wander of the hands, % of shoulder
        # width. BEST p.9/10: at anchor "movement slows down and becomes internal"
        # — the load is held by the back, so the hands barely drift. The on-body
        # analogue of group size; 0 = rock-steady. Targets are provisional pending
        # author-tool calibration on real footage.
        'id': 'hold_steadiness',
        'label': 'Steady hold',
        'frame': 'hold',
        'measure': 'hold_steadiness',
        'unit': '%',
        'target': 0.0, 'warn': 3.0, 'fail': 7.0,
        'view': 'rear',
        'tip': 'Minimise the float at full draw — let the back hold the load so '
               'the hands settle. Some motion is normal; aim to keep it small and '
               'smooth rather than dead-still by gripping.',
    },
    {
        # BEST p.11: release by relaxing the fingers ("let the string go");
        # the hand recoils straight back along the neck, in the same plane as
        # the arrow. A plucked shot throws the hand out of that line.
        'id': 'follow_through',
        'label': 'Follow-through back',
        'frame': 'follow_through',
        'measure': 'follow_through_direction',
        'unit': '°',
        'target': 180.0, 'warn': 25.0, 'fail': 50.0,
        'view': 'rear',
        'tip': 'Let the string go by relaxing the fingers — the draw hand should '
               'recoil straight back along the neck, in line with the arrow. A '
               'hand that flies out or forward shows the shot was plucked.',
    },
]


# ── Per-bowstyle overrides ─────────────────────────────────────────────────
# Each entry maps checkpoint id → field overrides merged onto the base spec.
# A value of None for an id drops that checkpoint for the bowstyle.
_OVERRIDES = {
    'compound': {
        # Release-aid follow-through is much smaller and less directional than a
        # finger loose, so widen the bands and relax the target rather than flag
        # a clean shot. Draw elbow tends to sit a touch higher with a wrist
        # strap, but alignment with the arrow still matters.
        'follow_through': {'warn': 40.0, 'fail': 70.0,
                           'tip': 'With a release aid the hand barely moves — '
                                  'just check it relaxes straight back, not out '
                                  'to the side (a sign of punching the trigger).'},
        # Compound anchors with the release hand set behind the jaw, reinforced
        # by secondary references rather than a single finger touch.
        'anchor_contact': {'tip': 'Set the release hand firmly behind the jaw '
                                  'and back it up with a consistent secondary '
                                  'reference — a kisser button at the lip and/or '
                                  'the nose touching the string — every shot.'},
    },
    'barebow': {
        # Barebow recurve anchors HIGH on the cheek (index finger into the
        # corner of the mouth), unlike the recurve under-jaw anchor. String-
        # walking changes finger position on the STRING, not the face contact,
        # so the cue is still a repeatable touch point; loosen the bands a little.
        'anchor_contact': {'warn': 16.0, 'fail': 30.0,
                           'tip': 'Barebow anchors high on the cheek — typically '
                                  'the index finger into the corner of the mouth, '
                                  'bone-to-bone. String-walking moves the fingers '
                                  'on the string, not on the face: hit the same '
                                  'face contact point every shot.'},
    },
}
# Traditional-family bows are shot more instinctively with a snap release and a
# more relaxed, varied form. Loosen every band ~50% and drop the clicker-era
# "conscious expansion" expectations rather than nag a working barebow loose.
_TRAD_RELAX = 1.5
_TRAD_DROP = ('draw_elbow_elevation',)  # too form-prescriptive for instinctive shooting


def _trad_overrides():
    ov = {cid: None for cid in _TRAD_DROP}
    for cp in _BASE_CHECKPOINTS:
        if cp['id'] in _TRAD_DROP:
            continue
        ov.setdefault(cp['id'], {})
        ov[cp['id']] = {
            'warn': round(cp['warn'] * _TRAD_RELAX, 1),
            'fail': round(cp['fail'] * _TRAD_RELAX, 1),
        }
    ov['follow_through'] = {
        'warn': round(_BASE_CHECKPOINTS[-1]['warn'] * _TRAD_RELAX, 1),
        'fail': round(_BASE_CHECKPOINTS[-1]['fail'] * _TRAD_RELAX, 1),
        'tip': 'Traditional shooting is more relaxed — look for a dynamic '
               'release that flows back, not a frozen follow-through.',
    }
    # Traditional/instinctive archers anchor high — usually the index finger or
    # thumb at the corner of the mouth — not under the jaw. Keep the loosened
    # bands from the loop above; just replace the recurve tip.
    ov['anchor_contact'] = dict(ov['anchor_contact'], tip=(
        'Traditional shooting usually anchors high — the index finger (or '
        'thumb) at the corner of the mouth. Pick one spot and hit it every '
        'shot; consistency matters more than which point you choose.'))
    return ov


for _bs in _TRAD_LIKE:
    _OVERRIDES[_bs] = _trad_overrides()


def checkpoints_for(bowstyle):
    """Return the resolved checkpoint list for a bowstyle (deep-copied).

    Falls back to the base recurve set for unknown / empty bowstyles so the
    page always renders something sensible. The returned list is a fresh copy
    each call — safe to mutate, JSON-encode, or hand to a template.
    """
    bs = (bowstyle or '').strip().lower()
    overrides = _OVERRIDES.get(bs, {})
    resolved = []
    for cp in _BASE_CHECKPOINTS:
        ov = overrides.get(cp['id'], {})
        if ov is None:  # explicitly dropped for this bowstyle
            continue
        merged = copy.deepcopy(cp)
        merged.update(ov)
        resolved.append(merged)
    return resolved


def all_bowstyles():
    """Every bowstyle with a checkpoint profile (drives the /form picker).

    Includes compound, which has its own overrides on the base set but is not in
    _RECURVE_LIKE / _TRAD_LIKE (those name the form *families*, not the full
    list). Omitting it here silently dropped compound from the page and fell a
    compound archer back to recurve checkpoints.
    """
    return tuple(_RECURVE_LIKE) + ('compound',) + tuple(_TRAD_LIKE)
