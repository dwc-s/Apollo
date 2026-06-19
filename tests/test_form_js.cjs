/* Deterministic tests for the pure form-analysis math in static/apollo-form.js.
 *
 * The pose pipeline (camera/MediaPipe) can't be unit-tested, but the geometry,
 * measures, phase detection, and scoring are pure functions of landmark data.
 * We feed synthetic skeletons with known angles and assert the outputs.
 *
 * Run: node tests/test_form_js.cjs   (exits non-zero on first failure)
 */
'use strict';
const assert = require('assert');
const F = require('../static/apollo-form.js');
const fc = { /* mirror of a couple of spec entries for scoring tests */ };

let passed = 0;
function ok(name, cond) {
    assert.ok(cond, name);
    passed++;
}
function near(name, a, b, tol) {
    assert.ok(Math.abs(a - b) <= (tol == null ? 0.5 : tol),
        `${name}: expected ~${b}, got ${a}`);
    passed++;
}

// 33-landmark frame, all visible, with specific indices overridden.
function frame(overrides) {
    const a = [];
    for (let i = 0; i < 33; i++) a.push({ x: 0.5, y: 0.5, visibility: 1 });
    Object.keys(overrides).forEach(i => { a[i] = Object.assign({ visibility: 1 }, overrides[i]); });
    return a;
}

const LM = F.LM;

// ── A "good form" right-handed anchor frame, hand-built for known angles ──
// Shoulders level; draw forearm collinear with the arrow (180°); bow shoulder
// in line; bow arm flat; spine vertical; head level; anchor gap 18% of
// shoulder width.
const good = frame({
    [LM.L_SHOULDER]: { x: 0.40, y: 0.50 },   // bow shoulder (right-handed)
    [LM.R_SHOULDER]: { x: 0.60, y: 0.50 },   // draw shoulder
    [LM.L_ELBOW]:    { x: 0.20, y: 0.50 },   // bow elbow (in line, left of bow sh)
    [LM.R_ELBOW]:    { x: 0.80, y: 0.50 },   // draw elbow (behind the arrow)
    [LM.L_WRIST]:    { x: 0.30, y: 0.50 },   // bow wrist
    [LM.R_WRIST]:    { x: 0.55, y: 0.50 },   // draw wrist (anchor)
    [LM.MOUTH_L]:    { x: 0.54, y: 0.536 },
    [LM.MOUTH_R]:    { x: 0.56, y: 0.536 },  // face ≈ (0.55, 0.536), 0.036 below wrist
    [LM.L_HIP]:      { x: 0.45, y: 0.80 },
    [LM.R_HIP]:      { x: 0.55, y: 0.80 },
    [LM.L_EAR]:      { x: 0.47, y: 0.42 },
    [LM.R_EAR]:      { x: 0.53, y: 0.42 },
});
const S = F.sides('right');

near('draw_elbow_elevation (collinear → 0)', F.SINGLE.draw_elbow_elevation(good, S), 0, 0.5);
near('shoulder_level (flat)', F.SINGLE.shoulder_level(good), 0, 0.5);
near('bow_shoulder_shrug (in line)', F.SINGLE.bow_shoulder_shrug(good, S), 0, 0.5);
near('bow_arm_elevation (flat)', F.SINGLE.bow_arm_elevation(good, S), 0, 0.5);
near('spine_lean (vertical)', F.SINGLE.spine_lean(good), 0, 0.5);
near('head_tilt (level)', F.SINGLE.head_tilt(good), 0, 0.5);
near('anchor_hand_to_face (18%)', F.SINGLE.anchor_hand_to_face(good, S), 18, 0.5);

// ── Degraded frames: known deviations should flip status ──
// Shoulder line tilted 20°.
const tilted = frame({
    [LM.L_SHOULDER]: { x: 0.40, y: 0.50 },
    [LM.R_SHOULDER]: { x: 0.60, y: 0.50 + 0.20 * Math.tan(20 * Math.PI / 180) },
});
near('shoulder_level (20° tilt)', F.SINGLE.shoulder_level(tilted), 20, 0.5);

// ── draw_elbow_elevation: SIGNED above(+)/below(−) the arrow line ──
// Arrow line is horizontal here (draw wrist 0.55 → bow wrist 0.30); the elbow
// straight back sits at y=0.50, so raising/lowering it flips the sign.
const elbowAbove = frame({
    [LM.L_WRIST]: { x: 0.30, y: 0.50 },
    [LM.R_WRIST]: { x: 0.55, y: 0.50 },
    [LM.R_ELBOW]: { x: 0.80, y: 0.40 },   // elbow above the line (smaller y = higher)
});
const elbowBelow = frame({
    [LM.L_WRIST]: { x: 0.30, y: 0.50 },
    [LM.R_WRIST]: { x: 0.55, y: 0.50 },
    [LM.R_ELBOW]: { x: 0.80, y: 0.60 },   // elbow below the line (a fault)
});
ok('draw_elbow_elevation positive when elbow above the line',
    F.SINGLE.draw_elbow_elevation(elbowAbove, S) > 5);
ok('draw_elbow_elevation negative when elbow below the line',
    F.SINGLE.draw_elbow_elevation(elbowBelow, S) < -5);
// Above and below by the same amount are equal-and-opposite (sign is the only
// difference), proving the measure carries direction the old unsigned one lost.
near('elevation above/below symmetric in magnitude',
    F.SINGLE.draw_elbow_elevation(elbowAbove, S),
    -F.SINGLE.draw_elbow_elevation(elbowBelow, S), 0.5);

// Handedness robustness: mirror the whole pose (arrow now points the other way)
// and drive it left-handed. "Above = +" must still hold — the sign comes from the
// vertical offset, not the (flipped) horizontal direction of the arrow line.
const SL = F.sides('left');
const leftAbove = frame({
    [LM.R_WRIST]: { x: 0.70, y: 0.50 },   // bow wrist (target to the right)
    [LM.L_WRIST]: { x: 0.45, y: 0.50 },   // draw wrist
    [LM.L_ELBOW]: { x: 0.20, y: 0.40 },   // draw elbow behind, above the line
});
const leftBelow = frame({
    [LM.R_WRIST]: { x: 0.70, y: 0.50 },
    [LM.L_WRIST]: { x: 0.45, y: 0.50 },
    [LM.L_ELBOW]: { x: 0.20, y: 0.60 },   // draw elbow behind, below the line
});
ok('draw_elbow_elevation positive above (left-handed, mirrored)',
    F.SINGLE.draw_elbow_elevation(leftAbove, SL) > 5);
ok('draw_elbow_elevation negative below (left-handed, mirrored)',
    F.SINGLE.draw_elbow_elevation(leftBelow, SL) < -5);

// ── Visibility gating: a low-visibility landmark yields null ──
const occluded = frame({ [LM.R_WRIST]: { x: 0.55, y: 0.50, visibility: 0.1 } });
ok('low-visibility wrist → null measure',
    F.SINGLE.anchor_hand_to_face(occluded, S) === null);

// ── follow_through_direction ──
const followGood = frame({
    [LM.L_WRIST]: { x: 0.30, y: 0.50 },
    [LM.R_WRIST]: { x: 0.65, y: 0.50 },   // draw hand moved back (right) from 0.55
});
near('follow_through (straight back)',
    F.MULTI.follow_through_direction(good, followGood, S), 180, 1);

const pluck = frame({
    [LM.L_WRIST]: { x: 0.30, y: 0.50 },
    [LM.R_WRIST]: { x: 0.55, y: 0.20 },   // hand jumped straight up (pluck)
});
near('follow_through (pluck = ~90° off)',
    F.MULTI.follow_through_direction(good, pluck, S), 90, 2);

// ── circular difference ──
near('circ 175 vs 180', F.circularDiffDeg(175, 180), 5, 0);
near('circ 185 vs 180', F.circularDiffDeg(185, 180), 5, 0);
near('circ 1 vs 359', F.circularDiffDeg(1, 359), 2, 0);

// ── scoreCheckpoint statuses ──
const cpAlign = { id: 'a', target: 180, warn: 10, fail: 22 };
ok('179° vs 180 target → pass', F.scoreCheckpoint(179, cpAlign).status === 'pass');
ok('168° vs 180 target → warn', F.scoreCheckpoint(168, cpAlign).status === 'warn');
ok('150° vs 180 target → fail', F.scoreCheckpoint(150, cpAlign).status === 'fail');
ok('null → unknown', F.scoreCheckpoint(null, cpAlign).status === 'unknown');

// ── Asymmetric tolerance (warn_low/fail_low) for signed measures ──
// Draw-elbow elevation: target 0, generous above, strict below the line.
const cpElev = { id: 'e', target: 0, warn: 10, fail: 22, warn_low: 3, fail_low: 10 };
ok('elbow +6° (slightly above) → pass', F.scoreCheckpoint(6, cpElev).status === 'pass');
ok('elbow +15° (well above) → warn', F.scoreCheckpoint(15, cpElev).status === 'warn');
ok('elbow −6° (dips below the line) → warn', F.scoreCheckpoint(-6, cpElev).status === 'warn');
ok('elbow −15° (well below) → fail', F.scoreCheckpoint(-15, cpElev).status === 'fail');
// The point of the asymmetry: the SAME magnitude reads differently by direction.
ok('asymmetry: +6 passes where −6 does not',
    F.scoreCheckpoint(6, cpElev).status === 'pass' &&
    F.scoreCheckpoint(-6, cpElev).status !== 'pass');
// Low-side falloff is steeper too (penalised sooner), not just the status flip.
ok('below-line sub-score lower than equal above',
    F.scoreCheckpoint(-8, cpElev).score < F.scoreCheckpoint(8, cpElev).score);
// Backward compatibility: no low bands → symmetric (−6 passes like +6).
const cpSym = { id: 's', target: 0, warn: 10, fail: 22 };
ok('symmetric fallback: −6 with no low bands → pass',
    F.scoreCheckpoint(-6, cpSym).status === 'pass');

// ── Unit-aware deviation: angles wrap, '%' metrics don't ──
const cpPct = { id: 'p', target: 18, warn: 12, fail: 25, unit: '%' };
ok('% metric uses linear deviation (no 360° wrap)',
    F.scoreCheckpoint(200, cpPct).deviation === 182);
const cpDeg = { id: 'd', target: 180, warn: 10, fail: 22, unit: '°' };
ok('degree metric still wraps (350 vs 180 = 170)',
    F.scoreCheckpoint(350, cpDeg).deviation === 170);

// ── scoreAll overall ──
const spec = [
    { id: 'a', measure: 'shoulder_level', target: 0, warn: 5, fail: 12, unit: '°' },
    { id: 'b', measure: 'head_tilt', target: 0, warn: 7, fail: 16, unit: '°' },
];
const allPass = F.scoreAll({ a: 1, b: 2 }, spec);
ok('scoreAll all-pass overall high', allPass.overall > 90 && allPass.scored === 2);
const someUnknown = F.scoreAll({ a: 1, b: null }, spec);
ok('scoreAll ignores unknown in overall', someUnknown.scored === 1);

// ── detectPhases on a synthetic draw→hold→release sequence ──
// Build samples where the draw hand approaches the face, holds, then leaves.
function sampleAt(gap) {
    // gap is the vertical distance from draw wrist down to the face.
    return {
        landmarks: frame({
            [LM.L_SHOULDER]: { x: 0.40, y: 0.50 },
            [LM.R_SHOULDER]: { x: 0.60, y: 0.50 },
            [LM.MOUTH_L]: { x: 0.54, y: 0.55 },
            [LM.MOUTH_R]: { x: 0.56, y: 0.55 },
            [LM.R_WRIST]: { x: 0.55, y: 0.55 - gap },  // closer to face as gap→0
        })
    };
}
// gaps (in normalized units): big → small (hold) → big (release)
const gapSeq = [0.30, 0.22, 0.12, 0.04, 0.035, 0.04, 0.04, 0.30, 0.34, 0.36];
const samples = gapSeq.map((g, i) => { const s = sampleAt(g); s.t = i / 15; return s; });
const phases = F.detectPhases(samples, 'right');
ok('anchor detected in the hold window',
    phases.anchorIndex >= 3 && phases.anchorIndex <= 6);
ok('follow-through detected after release',
    phases.followIndex >= 7);

// Single still frame → anchor only, no follow-through.
const onePhase = F.detectPhases([{ t: 0, landmarks: good }], 'right');
ok('single frame → anchor 0, no follow', onePhase.anchorIndex === 0 && onePhase.followIndex === -1);

// detectPhases now also bounds the steady-hold window (indices 3..6 above).
ok('detectPhases reports the hold window',
    phases.holdStart === 3 && phases.holdEnd === 6);

// ── Hold steadiness: float over the hold window, % of shoulder width ──
// Build a hold of `n` frames where both hands sit at a fixed point plus an
// alternating ±jitter; shoulders are fixed (width 0.20). RMS wander ≈
// jitter·√2, so the metric ≈ (jitter·√2 / 0.20)·100.
function holdSeq(jitter, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const d = (i % 2 ? 1 : -1) * jitter;
        arr.push({ t: i / 15, landmarks: frame({
            [LM.L_SHOULDER]: { x: 0.40, y: 0.50 },
            [LM.R_SHOULDER]: { x: 0.60, y: 0.50 },
            [LM.R_WRIST]: { x: 0.55 + d, y: 0.50 + d },   // draw wrist (right-handed)
            [LM.L_WRIST]: { x: 0.30 + d, y: 0.50 + d },   // bow wrist
        }) });
    }
    return arr;
}
const steadyHold = holdSeq(0.002, 8);   // ~1.4% of shoulder width
const shakyHold = holdSeq(0.020, 8);    // ~14% of shoulder width
const wholeWindow = { holdStart: 0, holdEnd: 7 };
const steadyVal = F.holdSteadiness(steadyHold, wholeWindow, S);
const shakyVal = F.holdSteadiness(shakyHold, wholeWindow, S);
ok('steady hold reads low', steadyVal != null && steadyVal < 3);
ok('shaky hold reads high', shakyVal != null && shakyVal > 5);
ok('shakier hold > steadier hold', shakyVal > steadyVal);
// Too few frames to judge → null (not a misleading 0).
ok('hold under 4 frames → null',
    F.holdSteadiness(holdSeq(0.002, 2), { holdStart: 0, holdEnd: 1 }, S) === null);
// No hold detected (holdStart -1) → null.
ok('no hold window → null',
    F.holdSteadiness(steadyHold, { holdStart: -1, holdEnd: -1 }, S) === null);
// Routed through measureAll via the WINDOW registry on a real spec entry.
const holdSpec = [{ id: 'hold_steadiness', measure: 'hold_steadiness',
                    target: 0, warn: 3, fail: 7, unit: '%' }];
const mAll = F.measureAll(holdSpec, steadyHold, wholeWindow, 'right');
ok('measureAll computes window measure', mAll.hold_steadiness != null && mAll.hold_steadiness < 3);

// ── Aspect correction: angles must not be skewed by width/height scaling ──
// Shoulders dx=0.2, raw dy=0.1 → 26.57° in square space. On a 2:1-wide frame
// (height/width = 0.5) the vertical is rescaled, so the true tilt is smaller.
const tiltFrame = frame({ [LM.L_SHOULDER]: { x: 0.40, y: 0.50 },
                          [LM.R_SHOULDER]: { x: 0.60, y: 0.60 } });
F.setMeasureAspect(1);
const tiltSquare = F.SINGLE.shoulder_level(tiltFrame);
F.setMeasureAspect(0.5);
const tiltWide = F.SINGLE.shoulder_level(tiltFrame);
F.setMeasureAspect(1);   // reset so nothing downstream inherits it
near('aspect 1: shoulder tilt 26.57°', tiltSquare, 26.57, 0.5);
near('aspect 0.5: same pose reads 14.04°', tiltWide, 14.04, 0.5);
ok('aspect correction shrinks the vertical component', tiltWide < tiltSquare);

console.log(`\n✓ all ${passed} form-math assertions passed`);
