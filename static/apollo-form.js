/* Motion-capture form analysis.
 *
 * Markerless pose estimation (vendored MediaPipe Tasks-Vision) extracts a body
 * skeleton from a recorded clip or the live camera ENTIRELY in the browser, then
 * a rule-based biomechanical scorer grades the archer's full-draw position and
 * follow-through against the per-bowstyle checkpoint spec the server embedded in
 * the page. The raw video never leaves the device and is never persisted — only
 * the derived joint angles + scores can be saved (optional POST).
 *
 * The file is in two halves:
 *   1. A pure geometry/measurement/scoring API (no DOM, no MediaPipe). This is
 *      what static/../tests exercise in Node, and it is exposed as
 *      window.ApolloForm in the browser.
 *   2. Browser bootstrap (camera/file capture, pose loop, canvas overlay, UI).
 *      Guarded so importing the file under Node only loads the pure half.
 */
(function () {
    'use strict';

    // ── BlazePose 33-landmark indices we use ───────────────────────────────
    var LM = {
        NOSE: 0, L_EAR: 7, R_EAR: 8, MOUTH_L: 9, MOUTH_R: 10,
        L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14,
        L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24
    };
    var VIS_MIN = 0.5;  // landmark visibility below this is treated as missing

    // Aspect correction. MediaPipe normalises x by image WIDTH and y by image
    // HEIGHT, so on a non-square frame (16:9, 4:3, …) the two axes have
    // different scales and any angle/length computed from the raw coords is
    // skewed. We rescale y into width-units (× height/width) so the measurement
    // space is isotropic and angles are true. Defaults to 1 (square / no-op),
    // which keeps the synthetic unit tests — built in isotropic space — valid;
    // the browser sets the real ratio from the video dimensions before measuring.
    var measureAspect = 1;
    function setMeasureAspect(heightOverWidth) {
        measureAspect = (heightOverWidth > 0) ? heightOverWidth : 1;
    }

    // ── Pure geometry helpers ──────────────────────────────────────────────
    // A "frame" is an array of 33 landmarks {x, y, visibility}. MediaPipe x/y
    // are normalised [0,1] with y pointing DOWN; we flip y (so angle math is in
    // a natural y-up frame) and scale it by measureAspect (see above). Any
    // landmark below VIS_MIN returns null and ripples up so the affected
    // checkpoint scores "unknown" rather than guessing.
    function pt(frame, i) {
        var p = frame && frame[i];
        if (!p) return null;
        if (p.visibility != null && p.visibility < VIS_MIN) return null;
        return { x: p.x, y: -p.y * measureAspect };
    }
    function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function mag(v) { return Math.hypot(v.x, v.y); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function angDeg(v) { return Math.atan2(v.y, v.x) * 180 / Math.PI; }

    // Unsigned angle between two vectors, 0..180.
    function angleBetween(u, v) {
        var du = mag(u), dv = mag(v);
        if (!du || !dv) return null;
        var c = (u.x * v.x + u.y * v.y) / (du * dv);
        c = Math.max(-1, Math.min(1, c));
        return Math.acos(c) * 180 / Math.PI;
    }
    // Angle at vertex p subtended by points a and b, 0..180.
    function angleAt(p, a, b) {
        if (!p || !a || !b) return null;
        return angleBetween(sub(a, p), sub(b, p));
    }
    // Tilt of a vector away from horizontal, 0..90 (0 = perfectly level).
    function fromHorizontal(v) {
        if (!v) return null;
        var a = Math.abs(angDeg(v));
        if (a > 90) a = 180 - a;
        return a;
    }
    // Tilt of a vector away from vertical, 0..90 (0 = perfectly upright).
    function fromVertical(v) {
        var h = fromHorizontal(v);
        return h == null ? null : 90 - h;
    }

    // Resolve draw-side / bow-side landmark indices from handedness. "right"
    // means the archer draws the string with the right hand and holds the bow
    // in the left (the usual convention). Anatomical sides are used so the
    // mapping is robust to whether the camera is in front of or behind the
    // archer (MediaPipe labels left/right anatomically).
    function sides(handedness) {
        if (handedness === 'left') {
            return {
                draw: { sh: LM.L_SHOULDER, el: LM.L_ELBOW, wr: LM.L_WRIST },
                bow: { sh: LM.R_SHOULDER, el: LM.R_ELBOW, wr: LM.R_WRIST }
            };
        }
        return {
            draw: { sh: LM.R_SHOULDER, el: LM.R_ELBOW, wr: LM.R_WRIST },
            bow: { sh: LM.L_SHOULDER, el: LM.L_ELBOW, wr: LM.L_WRIST }
        };
    }

    function facePoint(frame) {
        var ml = pt(frame, LM.MOUTH_L), mr = pt(frame, LM.MOUTH_R);
        if (ml && mr) return mid(ml, mr);
        return pt(frame, LM.NOSE);
    }
    function shoulderWidth(frame) {
        var l = pt(frame, LM.L_SHOULDER), r = pt(frame, LM.R_SHOULDER);
        return (l && r) ? dist(l, r) : null;
    }

    // ── Single-frame measures (scored on the anchor key-frame) ──────────────
    // Each returns a scalar in the unit its checkpoint expects, or null.
    var SINGLE = {
        // Draw-elbow elevation above (+) / below (−) the arrow line. The draw
        // forearm (wrist→elbow) should continue the arrow straight back; BEST
        // wants the elbow "level with or slightly above the line — never below",
        // so direction matters and the measure is SIGNED (target 0). Magnitude is
        // the forearm's angle off the backward arrow line; the sign is taken from
        // the VERTICAL part of the elbow's offset from that line, which makes
        // "above = +" hold regardless of handedness or which way the arrow points
        // (the horizontal direction of `back` flips, the vertical test doesn't).
        draw_elbow_elevation: function (f, S) {
            var dw = pt(f, S.draw.wr), de = pt(f, S.draw.el), bw = pt(f, S.bow.wr);
            if (!dw || !de || !bw) return null;
            var back = sub(dw, bw);   // arrow line extended backward, toward the elbow
            var fore = sub(de, dw);   // draw forearm: wrist → elbow
            var dev = angleBetween(back, fore);   // 0 = elbow dead in line, straight back
            if (dev == null) return null;
            var bb = back.x * back.x + back.y * back.y;
            var proj = (fore.x * back.x + fore.y * back.y) / bb;
            var perpY = fore.y - proj * back.y;   // vertical offset of the elbow from the line
            return perpY >= 0 ? dev : -dev;
        },
        // Tilt of the shoulder line from horizontal. 0° = level.
        shoulder_level: function (f) {
            var l = pt(f, LM.L_SHOULDER), r = pt(f, LM.R_SHOULDER);
            return (l && r) ? fromHorizontal(sub(r, l)) : null;
        },
        // Bow shoulder set in line: how far the (draw shoulder–bow shoulder–bow
        // elbow) angle departs from a straight 180°. A shrug bends it.
        bow_shoulder_shrug: function (f, S) {
            var a = angleAt(pt(f, S.bow.sh), pt(f, S.draw.sh), pt(f, S.bow.el));
            return a == null ? null : Math.abs(180 - a);
        },
        // Bow arm elevation off horizontal (side view). 0° = flat to target.
        bow_arm_elevation: function (f, S) {
            var sh = pt(f, S.bow.sh), wr = pt(f, S.bow.wr);
            return (sh && wr) ? fromHorizontal(sub(wr, sh)) : null;
        },
        // Torso lean from vertical (mid-hip → mid-shoulder).
        spine_lean: function (f) {
            var ls = pt(f, LM.L_SHOULDER), rs = pt(f, LM.R_SHOULDER);
            var lh = pt(f, LM.L_HIP), rh = pt(f, LM.R_HIP);
            if (!ls || !rs || !lh || !rh) return null;
            return fromVertical(sub(mid(ls, rs), mid(lh, rh)));
        },
        // Head roll: tilt of the ear line from horizontal.
        head_tilt: function (f) {
            var l = pt(f, LM.L_EAR), r = pt(f, LM.R_EAR);
            return (l && r) ? fromHorizontal(sub(r, l)) : null;
        },
        // Draw hand → face gap as a % of shoulder width (scale-free).
        anchor_hand_to_face: function (f, S) {
            var wr = pt(f, S.draw.wr), face = facePoint(f), sw = shoulderWidth(f);
            if (!wr || !face || !sw) return null;
            return (dist(wr, face) / sw) * 100;
        }
    };

    // ── Multi-frame measures (need the anchor AND follow-through frames) ────
    var MULTI = {
        // Direction the draw hand travels from anchor to follow-through,
        // relative to the arrow's line to target. A clean back-tension release
        // sends it straight back (≈180° opposed to the arrow); a pluck throws
        // it out to the side, dropping the angle.
        follow_through_direction: function (anchorF, followF, S) {
            var aw = pt(anchorF, S.draw.wr), fw = pt(followF, S.draw.wr);
            var bw = pt(anchorF, S.bow.wr);
            if (!aw || !fw || !bw) return null;
            var disp = sub(fw, aw);
            // Movement too small to judge direction (hand barely left the face).
            if (mag(disp) < 0.01) return null;
            var arrow = sub(bw, aw);  // anchor draw-hand → bow-hand ≈ arrow line
            return angleBetween(disp, arrow);
        }
    };

    // ── Scoring ─────────────────────────────────────────────────────────────
    function circularDiffDeg(a, b) {
        var d = Math.abs(a - b) % 360;
        if (d > 180) d = 360 - d;
        return d;
    }
    // Status + smooth 0..100 sub-score for one checkpoint reading.
    function scoreCheckpoint(measured, cp) {
        if (measured == null || isNaN(measured)) {
            return { status: 'unknown', measured: null, deviation: null, score: null };
        }
        // Angles wrap (175° vs 185° are 10° apart, not 350); linear units like
        // '%' (anchor gap, hold steadiness) must NOT wrap, or a reading above
        // 180% would fold back toward the target and score a worse shot as
        // better. Checkpoints with no unit (the synthetic test cases) keep the
        // angular default.
        var dev = (cp.unit === '°' || cp.unit == null)
            ? circularDiffDeg(measured, cp.target)
            : Math.abs(measured - cp.target);
        // Asymmetric tolerance: a SIGNED measure can carry tighter low-side bands
        // (warn_low/fail_low) used only when the reading sits below its target —
        // e.g. the draw elbow may sit slightly ABOVE the arrow line (pass) but
        // dipping BELOW it is a fault flagged sooner. Falls back to the symmetric
        // warn/fail when the low-side bands are absent (backward compatible).
        var warn = cp.warn, fail = cp.fail;
        if (measured < cp.target) {
            if (cp.warn_low != null) warn = cp.warn_low;
            if (cp.fail_low != null) fail = cp.fail_low;
        }
        var status = dev <= warn ? 'pass' : (dev <= fail ? 'warn' : 'fail');
        // Linear falloff: full marks at/under warn, 0 at twice fail.
        var span = Math.max(fail * 2, warn + 1e-6);
        var score = Math.max(0, Math.min(100, 100 * (1 - dev / span)));
        return { status: status, measured: measured, deviation: dev, score: score };
    }
    // Grade a whole checkpoint spec against pre-measured values.
    // `measured` maps checkpoint id → scalar (or null). Returns per-id results
    // plus an overall 0..100 (mean of known sub-scores; null if none known).
    function scoreAll(measured, checkpoints) {
        var results = {}, sum = 0, n = 0;
        checkpoints.forEach(function (cp) {
            var r = scoreCheckpoint(measured ? measured[cp.id] : null, cp);
            results[cp.id] = r;
            if (r.score != null) { sum += r.score; n += 1; }
        });
        return { results: results, overall: n ? sum / n : null, scored: n };
    }

    // Measure every checkpoint in a spec from the anchor (+ follow-through)
    // frames for a given handedness. Returns id → scalar|null.
    function measureAll(checkpoints, samples, phases, handedness) {
        var S = sides(handedness);
        var anchorFrame = (phases && phases.anchorIndex >= 0)
            ? samples[phases.anchorIndex].landmarks : null;
        var followFrame = (phases && phases.followIndex >= 0)
            ? samples[phases.followIndex].landmarks : null;
        var out = {};
        checkpoints.forEach(function (cp) {
            if (SINGLE[cp.measure]) {
                out[cp.id] = anchorFrame ? SINGLE[cp.measure](anchorFrame, S) : null;
            } else if (MULTI[cp.measure]) {
                out[cp.id] = (anchorFrame && followFrame)
                    ? MULTI[cp.measure](anchorFrame, followFrame, S) : null;
            } else if (WINDOW[cp.measure]) {
                out[cp.id] = WINDOW[cp.measure](samples, phases, S);
            } else {
                out[cp.id] = null;
            }
        });
        return out;
    }

    // ── Phase detection ─────────────────────────────────────────────────────
    // Given a time-ordered list of {t, landmarks} samples, find the full-draw
    // (anchor) frame and a follow-through frame. Heuristic but robust for a
    // single fixed camera: full draw is the sustained minimum of draw-hand→face
    // distance; release is where that distance jumps back up afterwards.
    function detectPhases(samples, handedness) {
        var S = sides(handedness);
        var NONE = { anchorIndex: -1, followIndex: -1, holdStart: -1, holdEnd: -1 };
        if (!samples || !samples.length) return NONE;
        if (samples.length === 1) return { anchorIndex: 0, followIndex: -1, holdStart: -1, holdEnd: -1 };

        var gaps = samples.map(function (s) {
            var wr = pt(s.landmarks, S.draw.wr);
            var face = facePoint(s.landmarks);
            var sw = shoulderWidth(s.landmarks);
            if (!wr || !face || !sw) return Infinity;
            return dist(wr, face) / sw;  // normalised hand→face gap
        });
        var valid = gaps.filter(function (g) { return isFinite(g); });
        if (!valid.length) return { anchorIndex: 0, followIndex: -1, holdStart: -1, holdEnd: -1 };

        var minGap = Math.min.apply(null, valid);
        // Frames "at anchor": hand held close to the face. Threshold scales with
        // the observed minimum so it works whether the camera is near or far.
        var thresh = minGap + Math.max(0.04, minGap * 0.4);
        // Longest run under threshold = the hold. Pick its middle as anchor.
        var bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
        for (var i = 0; i < gaps.length; i++) {
            if (gaps[i] <= thresh) {
                if (curStart < 0) curStart = i;
                curLen++;
                if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
            } else { curStart = -1; curLen = 0; }
        }
        if (bestStart < 0) {  // never clearly anchored: fall back to global min
            var anchorIndex = gaps.indexOf(minGap);
            return { anchorIndex: anchorIndex, followIndex: -1, holdStart: -1, holdEnd: -1 };
        }
        var holdEnd = bestStart + bestLen - 1;
        var anchorIdx = bestStart + Math.floor(bestLen / 2);

        // Follow-through: first frame after the hold where the hand has clearly
        // left the face, nudged a couple of frames later to catch the motion.
        var followIdx = -1;
        for (var j = holdEnd + 1; j < gaps.length; j++) {
            // Require a finite gap: an Infinity here is a frame where the draw
            // hand/face wasn't tracked, not evidence the hand left the face.
            if (isFinite(gaps[j]) && gaps[j] > thresh * 1.6) {
                followIdx = Math.min(j + 2, gaps.length - 1); break;
            }
        }
        // holdStart/holdEnd bound the steady-hold window so a window measure
        // (e.g. hold steadiness) can quantify the float across those frames.
        return { anchorIndex: anchorIdx, followIndex: followIdx,
                 holdStart: bestStart, holdEnd: holdEnd };
    }

    // ── Window measures (computed over the whole hold, not one frame) ───────
    // Hold steadiness: how much the hands wander during the steady-hold window,
    // as a % of shoulder width (scale-free). It is the on-body analogue of group
    // size — the quantified "float" at full draw. 0 = rock-steady; bigger = more
    // wobble. Returns null if the hold is too brief to be meaningful.
    function rmsSpread(points) {
        if (points.length < 4) return null;
        var cx = 0, cy = 0, i;
        for (i = 0; i < points.length; i++) { cx += points[i].x; cy += points[i].y; }
        cx /= points.length; cy /= points.length;
        var s = 0;
        for (i = 0; i < points.length; i++) {
            var dx = points[i].x - cx, dy = points[i].y - cy;
            s += dx * dx + dy * dy;
        }
        return Math.sqrt(s / points.length);
    }
    function holdSteadiness(samples, phases, S) {
        var a = phases && phases.holdStart, b = phases && phases.holdEnd;
        if (a == null || b == null || a < 0 || b < a || (b - a + 1) < 4) return null;
        var draw = [], bow = [], sw = [];
        for (var i = a; i <= b; i++) {
            var f = samples[i].landmarks;
            var dw = pt(f, S.draw.wr), bw = pt(f, S.bow.wr), w = shoulderWidth(f);
            if (dw) draw.push(dw);
            if (bw) bow.push(bw);
            if (w) sw.push(w);
        }
        if (!sw.length) return null;
        var meanSW = sw.reduce(function (x, y) { return x + y; }, 0) / sw.length;
        if (!meanSW) return null;
        var parts = [], dr = rmsSpread(draw), br = rmsSpread(bow);
        if (dr != null) parts.push(dr);
        if (br != null) parts.push(br);
        if (!parts.length) return null;
        var rms = parts.reduce(function (x, y) { return x + y; }, 0) / parts.length;
        return (rms / meanSW) * 100;
    }
    var WINDOW = {
        hold_steadiness: function (samples, phases, S) {
            return holdSteadiness(samples, phases, S);
        }
    };

    // ── Public pure API (browser + Node) ────────────────────────────────────
    var API = {
        LM: LM, VIS_MIN: VIS_MIN,
        geom: {
            pt: pt, sub: sub, mid: mid, dist: dist, angleBetween: angleBetween,
            angleAt: angleAt, fromHorizontal: fromHorizontal, fromVertical: fromVertical
        },
        sides: sides,
        setMeasureAspect: setMeasureAspect,
        SINGLE: SINGLE, MULTI: MULTI, WINDOW: WINDOW,
        circularDiffDeg: circularDiffDeg,
        scoreCheckpoint: scoreCheckpoint,
        scoreAll: scoreAll,
        measureAll: measureAll,
        holdSteadiness: holdSteadiness,
        detectPhases: detectPhases
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (typeof window !== 'undefined') window.ApolloForm = API;

    // ═══════════════════════════════════════════════════════════════════════
    // Browser bootstrap. Everything below touches the DOM / camera / MediaPipe
    // and only runs in a browser; Node imports stop at the pure API above.
    // ═══════════════════════════════════════════════════════════════════════
    if (typeof document === 'undefined') return;

    var MP_BASE = '/static/vendor/mediapipe';
    var MP_WASM = MP_BASE + '/wasm';
    var MP_MODEL = MP_BASE + '/pose_landmarker_lite.task';
    // Skeleton edges to draw for the overlay (subset of BlazePose connections).
    var EDGES = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24],
        [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [11, 7], [12, 8], [9, 10]
    ];

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        var root = document.getElementById('form-analyzer');
        if (!root) return;

        var payloadEl = document.getElementById('form-payload');
        var payload = {};
        try { payload = JSON.parse(payloadEl.textContent); } catch (e) { payload = {}; }
        var specs = payload.specs || {};
        var authorMode = !!payload.author;

        // Elements
        var els = {
            bowstyle: document.getElementById('form-bowstyle'),
            hand: document.getElementById('form-handedness'),
            video: document.getElementById('form-video'),
            canvas: document.getElementById('form-canvas'),
            file: document.getElementById('form-file'),
            fileBtn: document.getElementById('form-file-btn'),
            camBtn: document.getElementById('form-cam-btn'),
            stopBtn: document.getElementById('form-stop-btn'),
            status: document.getElementById('form-status'),
            results: document.getElementById('form-results'),
            saveBtn: document.getElementById('form-save-btn')
        };
        var ctx2d = els.canvas ? els.canvas.getContext('2d') : null;

        // Restore handedness preference.
        try {
            var savedHand = localStorage.getItem('apollo_form_hand');
            if (savedHand && els.hand) els.hand.value = savedHand;
        } catch (e) { /* private mode */ }

        var landmarker = null;       // MediaPipe PoseLandmarker (reused across runs)
        var liveStream = null;       // active MediaStream during camera capture
        var liveSamples = null;      // samples being collected in camera mode
        var liveRunning = false;
        var lastResult = null;       // {bowstyle, metrics, scores, overall}

        // MediaPipe VIDEO mode requires the timestamp passed to detectForVideo
        // to be STRICTLY INCREASING for the lifetime of the landmarker. Since we
        // reuse one landmarker across analyses, file timestamps (which restart
        // near 0 every clip) would go backwards on the 2nd run and throw. Funnel
        // every detect through one monotonic clock so order is always preserved.
        var lastDetectTs = 0;
        function nextDetectTs(preferredMs) {
            var v = Math.round(preferredMs);
            if (!(v > lastDetectTs)) v = lastDetectTs + 1;
            lastDetectTs = v;
            return v;
        }

        // One analysis at a time. The landmarker is not re-entrant, so two
        // overlapping runs — a double-clicked "Record", or picking a file while
        // a run is in flight — would call detectForVideo concurrently and leak
        // the first camera stream (its tracks never stopped). The guard disables
        // the start buttons for the duration; Stop stays live so an in-progress
        // recording can still be ended.
        var busy = false;
        function setBusy(b) {
            busy = b;
            if (els.camBtn) els.camBtn.disabled = b;
            if (els.fileBtn) els.fileBtn.disabled = b;
        }

        function setStatus(msg, kind) {
            if (!els.status) return;
            els.status.textContent = msg || '';
            els.status.className = 'form-status' + (kind ? ' ' + kind : '');
        }
        function handedness() { return (els.hand && els.hand.value) || 'right'; }
        function currentSpec() {
            var bs = (els.bowstyle && els.bowstyle.value) || payload.bowstyle;
            return specs[bs] || specs[payload.bowstyle] || [];
        }

        // Lazily create the pose landmarker (heavy: loads WASM + model once).
        function ensureLandmarker() {
            if (landmarker) return Promise.resolve(landmarker);
            setStatus('Loading pose model…', 'busy');
            return import(MP_BASE + '/vision_bundle.mjs').then(function (vision) {
                return vision.FilesetResolver.forVisionTasks(MP_WASM).then(function (fileset) {
                    return vision.PoseLandmarker.createFromOptions(fileset, {
                        baseOptions: { modelAssetPath: MP_MODEL },
                        runningMode: 'VIDEO',
                        numPoses: 1,
                        minPoseDetectionConfidence: 0.5,
                        minTrackingConfidence: 0.5
                    });
                });
            }).then(function (lm) { landmarker = lm; return lm; });
        }

        function sizeCanvasToVideo() {
            if (!els.canvas || !els.video) return;
            var w = els.video.videoWidth || 640, h = els.video.videoHeight || 480;
            els.canvas.width = w; els.canvas.height = h;
            // Calibrate the measurement space to this video's aspect so angles
            // aren't skewed by width/height normalisation (see setMeasureAspect).
            setMeasureAspect(h / w);
        }

        // Draw a landmark frame's skeleton onto the overlay canvas.
        function drawSkeleton(frame, label) {
            if (!ctx2d || !frame) return;
            var W = els.canvas.width, H = els.canvas.height;
            ctx2d.clearRect(0, 0, W, H);
            ctx2d.lineWidth = Math.max(2, W / 250);
            ctx2d.strokeStyle = 'rgba(40,90,200,0.9)';
            EDGES.forEach(function (e) {
                var a = frame[e[0]], b = frame[e[1]];
                if (!a || !b) return;
                if ((a.visibility != null && a.visibility < VIS_MIN) ||
                    (b.visibility != null && b.visibility < VIS_MIN)) return;
                ctx2d.beginPath();
                ctx2d.moveTo(a.x * W, a.y * H);
                ctx2d.lineTo(b.x * W, b.y * H);
                ctx2d.stroke();
            });
            ctx2d.fillStyle = 'rgba(200,40,60,0.95)';
            var r = Math.max(3, W / 180);
            frame.forEach(function (p) {
                if (!p || (p.visibility != null && p.visibility < VIS_MIN)) return;
                ctx2d.beginPath();
                ctx2d.arc(p.x * W, p.y * H, r, 0, Math.PI * 2);
                ctx2d.fill();
            });
            if (label) {
                ctx2d.font = '14px sans-serif';   // set before measuring
                ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
                ctx2d.fillRect(0, 0, ctx2d.measureText(label).width + 16, 26);
                ctx2d.fillStyle = '#fff';
                ctx2d.fillText(label, 8, 18);
            }
        }

        // Run pose over a seekable <video> file by stepping through it.
        function analyzeVideoFile() {
            return ensureLandmarker().then(function () {
                sizeCanvasToVideo();
                var dur = els.video.duration;
                if (!isFinite(dur) || dur <= 0) dur = 4;
                var step = 1 / 15;           // ~15 fps sampling is plenty for form
                var maxFrames = 240;         // hard cap (~16s) — privacy + speed
                var times = [];
                for (var t = 0; t < dur && times.length < maxFrames; t += step) times.push(t);
                var samples = [];
                setStatus('Analysing clip…', 'busy');

                return times.reduce(function (chain, t) {
                    return chain.then(function () {
                        return new Promise(function (resolve) {
                            var settled = false;
                            var timer = setTimeout(grab, 1000);
                            function grab() {
                                if (settled) return;
                                settled = true;
                                clearTimeout(timer);
                                els.video.removeEventListener('seeked', grab);
                                var res = landmarker.detectForVideo(els.video,
                                    nextDetectTs(t * 1000));
                                if (res && res.landmarks && res.landmarks[0]) {
                                    samples.push({ t: t, landmarks: res.landmarks[0] });
                                }
                                resolve();
                            }
                            els.video.addEventListener('seeked', grab);
                            // Seeking to a time the video is already at (notably
                            // t=0 right after load) fires no 'seeked' event, which
                            // would hang the chain — grab the current frame now.
                            // The timeout above is a final guard against a missed
                            // event so one stuck frame can't freeze the analysis.
                            if (Math.abs(els.video.currentTime - t) < 1e-3) grab();
                            else els.video.currentTime = t;
                        });
                    });
                }, Promise.resolve()).then(function () { return samples; });
            });
        }

        // Live camera capture: record samples until the user clicks Stop (or a
        // safety cap). Returns the collected samples.
        function analyzeCamera() {
            return ensureLandmarker().then(function () {
                return navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: 640, height: 480 },
                    audio: false
                });
            }).then(function (stream) {
                liveStream = stream;
                els.video.srcObject = stream;
                els.video.muted = true;
                return els.video.play().then(function () {
                    sizeCanvasToVideo();
                    liveSamples = [];
                    liveRunning = true;
                    if (els.stopBtn) els.stopBtn.hidden = false;
                    setStatus('Recording — shoot your shot, then press Stop.', 'busy');
                    var t0 = performance.now();
                    return new Promise(function (resolve) {
                        function loop() {
                            if (!liveRunning) { resolve(liveSamples); return; }
                            var now = performance.now();
                            var res = landmarker.detectForVideo(els.video, nextDetectTs(now));
                            if (res && res.landmarks && res.landmarks[0]) {
                                liveSamples.push({ t: (now - t0) / 1000, landmarks: res.landmarks[0] });
                                drawSkeleton(res.landmarks[0]);
                            }
                            // Safety cap ~30s so a forgotten Stop can't run forever.
                            if (now - t0 > 30000 || liveSamples.length > 600) {
                                stopCamera();
                            }
                            requestAnimationFrame(loop);
                        }
                        requestAnimationFrame(loop);
                    });
                });
            });
        }

        function stopCamera() {
            liveRunning = false;
            if (els.stopBtn) els.stopBtn.hidden = true;
            if (liveStream) {
                liveStream.getTracks().forEach(function (tr) { tr.stop(); });
                liveStream = null;
            }
            if (els.video) { els.video.pause(); els.video.srcObject = null; }
        }

        // Common tail: phases → measure → score → render, then scrub all video.
        function processSamples(samples) {
            var spec = currentSpec();
            var hand = handedness();
            if (!samples || !samples.length) {
                setStatus('No body detected in the footage. Try better lighting and keep your whole body in frame.', 'error');
                return;
            }
            var phases = detectPhases(samples, hand);
            var anchorF = phases.anchorIndex >= 0 ? samples[phases.anchorIndex].landmarks : null;
            var followF = phases.followIndex >= 0 ? samples[phases.followIndex].landmarks : null;
            var measured = measureAll(spec, samples, phases, hand);
            var graded = scoreAll(measured, spec);

            if (anchorF) drawSkeleton(anchorF, 'Full draw');
            renderResults(spec, measured, graded, phases.followIndex >= 0);

            lastResult = {
                bowstyle: (els.bowstyle && els.bowstyle.value) || payload.bowstyle,
                metrics: measured,
                scores: {},
                overall_score: graded.overall
            };
            Object.keys(graded.results).forEach(function (id) {
                lastResult.scores[id] = {
                    status: graded.results[id].status,
                    deviation: graded.results[id].deviation
                };
            });
            if (els.saveBtn && !authorMode) els.saveBtn.hidden = (graded.overall == null);

            var pct = graded.overall == null ? '—' : Math.round(graded.overall);
            setStatus('Analysis complete — form score ' + pct +
                (followF ? '' : ' (no follow-through detected — record through the release for that checkpoint).'), 'ok');
        }

        // Always-on cleanup after a run: drop the file/stream so no video lingers.
        function scrubVideo() {
            try {
                if (els.video) {
                    if (els.video.src) { URL.revokeObjectURL(els.video.src); els.video.removeAttribute('src'); }
                    els.video.srcObject = null;
                    els.video.load();
                }
            } catch (e) { /* ignore */ }
        }

        function renderResults(spec, measured, graded, hadFollow) {
            if (!els.results) return;
            var html = '';
            var pct = graded.overall == null ? '—' : Math.round(graded.overall);
            html += '<div class="form-score-banner"><span class="form-score-num">' + pct +
                '</span><span class="form-score-label">overall form</span></div>';
            html += '<ul class="form-checklist">';
            spec.forEach(function (cp) {
                var r = graded.results[cp.id];
                var status = r.status;
                var icon = status === 'pass' ? '✓' : (status === 'warn' ? '!' : (status === 'fail' ? '✕' : '–'));
                var reading;
                if (r.measured == null) {
                    if (cp.frame === 'follow_through' && !hadFollow) reading = 'not captured';
                    else if (cp.frame === 'hold') reading = 'hold too brief';
                    else reading = 'not visible';
                } else {
                    reading = Math.round(r.measured) + (cp.unit || '') +
                        ' (target ' + Math.round(cp.target) + (cp.unit || '') + ')';
                }
                html += '<li class="form-cp form-cp-' + status + '">' +
                    '<span class="form-cp-icon">' + icon + '</span>' +
                    '<div class="form-cp-body"><div class="form-cp-head">' +
                    '<span class="form-cp-label">' + cp.label + '</span>' +
                    '<span class="form-cp-reading">' + reading + '</span></div>';
                if (authorMode) {
                    // Learning mode: surface the raw number for transcription.
                    html += '<div class="form-cp-tip">measured: ' +
                        (r.measured == null ? 'null' : r.measured.toFixed(2)) +
                        (cp.unit || '') + ' · dev ' +
                        (r.deviation == null ? 'null' : r.deviation.toFixed(2)) + '</div>';
                } else if (status !== 'pass' && status !== 'unknown') {
                    html += '<div class="form-cp-tip">' + cp.tip + '</div>';
                }
                html += '</div></li>';
            });
            html += '</ul>';
            els.results.innerHTML = html;
            els.results.hidden = false;
        }

        function handleError(err) {
            console.error('[form] analysis error', err);
            var msg = 'Something went wrong analysing the footage.';
            if (err && err.name === 'NotAllowedError') msg = 'Camera permission denied.';
            else if (err && err.name === 'NotFoundError') msg = 'No camera found.';
            else if (location.protocol !== 'https:' && location.hostname !== 'localhost')
                msg = 'Camera capture needs HTTPS (or localhost).';
            setStatus(msg, 'error');
        }

        // ── Wire UI ──────────────────────────────────────────────────────
        if (els.fileBtn) els.fileBtn.addEventListener('click', function () { els.file.click(); });
        if (els.file) els.file.addEventListener('change', function () {
            var f = els.file.files && els.file.files[0];
            // Reset the input so picking the SAME file again re-fires 'change'.
            els.file.value = '';
            if (!f || busy) return;
            setBusy(true);
            stopCamera();
            els.video.srcObject = null;
            els.video.src = URL.createObjectURL(f);
            els.video.muted = true;
            // Either the data loads (→ analyse) or the file can't be decoded
            // (→ report and release the busy lock so the UI isn't wedged). Guard
            // against both firing and against either firing twice.
            var started = false;
            function cleanup() {
                els.video.removeEventListener('loadeddata', onData);
                els.video.removeEventListener('error', onErr);
            }
            function onData() {
                if (started) return; started = true; cleanup();
                analyzeVideoFile()
                    .then(processSamples)
                    .catch(handleError)
                    .then(function () { scrubVideo(); setBusy(false); });
            }
            function onErr() {
                if (started) return; started = true; cleanup();
                setStatus('Could not read that video file.', 'error');
                scrubVideo();
                setBusy(false);
            }
            els.video.addEventListener('loadeddata', onData);
            els.video.addEventListener('error', onErr);
            els.video.load();
        });
        if (els.camBtn) els.camBtn.addEventListener('click', function () {
            if (busy) return;
            setBusy(true);
            analyzeCamera()
                .then(function (samples) { stopCamera(); return samples; })
                .then(processSamples)
                .catch(handleError)
                .then(function () { scrubVideo(); setBusy(false); });
        });
        if (els.stopBtn) els.stopBtn.addEventListener('click', stopCamera);
        if (els.hand) els.hand.addEventListener('change', function () {
            try { localStorage.setItem('apollo_form_hand', els.hand.value); } catch (e) {}
        });

        // Save derived metrics (analysis mode only). Never sends video.
        if (els.saveBtn) els.saveBtn.addEventListener('click', function () {
            if (!lastResult || authorMode) return;
            var tokenEl = document.querySelector('input[name="csrf_token"]');
            var token = tokenEl ? tokenEl.value : '';
            els.saveBtn.disabled = true;
            fetch(payload.save_url || '/form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
                body: JSON.stringify({
                    bowstyle: lastResult.bowstyle,
                    metrics: lastResult.metrics,
                    scores: lastResult.scores,
                    overall_score: lastResult.overall_score
                })
            }).then(function (r) { return r.json(); }).then(function (j) {
                setStatus(j && j.ok ? 'Saved to your form history.' : 'Could not save.', j && j.ok ? 'ok' : 'error');
            }).catch(function () { setStatus('Could not save.', 'error'); })
              .then(function () { els.saveBtn.disabled = false; });
        });

        // Stop the camera if the user navigates away mid-record.
        window.addEventListener('pagehide', stopCamera);
    });
})();
