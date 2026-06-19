v0.78 — Form read from light, the video kept by no one

Apollo has always scored where the arrow lands. This release adds a way to look
at the archer instead of the arrow: a new **Form** page that watches a clip of
your shot and measures your body against good-form checkpoints — the line, level
shoulders, the draw elbow, the anchor, the follow-through.

It runs entirely in your browser. A markerless pose model (vendored MediaPipe)
turns the footage into a skeleton, the skeleton into angles, and the angles into
feedback — and the video is never uploaded and never saved. Only the derived
numbers (joint angles, scores) are stored, under your account like everything
else.

- **The /form page.** Record with your camera or pick a clip, and Apollo finds
  your full-draw frame, overlays the skeleton, and grades each checkpoint
  pass / warn / fail with the measured value and a coaching tip. Best shot from
  **behind the shooting line**, level with the archer.

- **Real measurements, not just a verdict.** Every checkpoint is a number:
  draw-elbow elevation above/below the arrow line (signed — slightly above is
  fine, below is a fault), shoulder and head tilt, bow-shoulder set, posture
  lean, anchor gap, and follow-through direction — degrees, or % of shoulder
  width where that's the honest unit. Angles are aspect-corrected so a 16:9 clip
  reads the same as a square one.

- **Hold steadiness.** The float at full draw, measured across the whole hold
  window as the RMS wander of the hands — the on-body analogue of group size.

- **Shot-to-shot consistency.** Save a few analyses and the page shows the mean
  and spread (± standard deviation) of each element across your recent shots,
  because repeatability matters more than any single perfect frame.

- **Grounded in the BEST method.** The checkpoint targets, tolerances and tips
  follow USA Archery's Biomechanically Efficient Shooting Technique, with the
  guidance specialised per bowstyle — the recurve under-jaw anchor, barebow's
  index-to-mouth-corner, compound behind the jaw with a release, traditional's
  high instinctive anchor. Recurve, compound, barebow, longbow, traditional and
  flatbow each get their own checkpoint set.

- **Two separate modes.** A user-facing **analysis** mode that only reads the
  reference, and a root-only **learning** mode (`/form/author`) for tuning the
  reference targets against a known-good archer — so a user's form can never
  drift the standard.

Under the floor: a new `form_captures` table (derived metrics only — there is no
video column, by design, and account deletion purges it); the content-security
policy gains `'wasm-unsafe-eval'` so the in-browser pose model can run; the
vendored MediaPipe assets are cached by the service worker, so once loaded the
analysis works offline. New pure modules `form_checkpoints.py` (the reference
spec) and `static/apollo-form.js` (geometry, phase detection and scoring,
unit-tested in Node). 29 Python tests, 47 form-math assertions, and an
end-to-end pass over the real Flask stack all green.

Still to come: the pass / warn / fail thresholds are sound estimates but not yet
calibrated against real footage — that's exactly what the learning mode is for.
