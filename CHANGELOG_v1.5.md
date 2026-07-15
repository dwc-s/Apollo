v1.5 — Eight interactive & 3D charts: a rotatable shot-density mountain, dispersion cone, history core-sample and score landscape; animated group-evolution and within-session playback; arrows that rain onto the predict face; and a handicap line that draws itself on and pings each class

Every chart in Apollo so far has been a static image — a Matplotlib figure
rendered to SVG on the server and dropped onto the page. That's crisp and
offline-friendly, but it can't be rotated, played, or explored. This release
adds Apollo's first **client-rendered** charts: eight of them, four 3D and four
animated, drawn in your browser from raw coordinate data the server ships
instead of a picture. Under the hood the reports now hand the page arrays of
numbers (a `chart3d` or `anim` payload) and a small amount of JavaScript builds
the visual — 3D via a self-hosted **Plotly** bundle, animation via SVG. Nothing
leaves your machine; the Plotly library is served from Apollo's own `/static`,
so the app stays fully same-origin and offline-capable.

**Four rotatable 3D charts (drag to spin, scroll to zoom).**

- **Shot-density mountain** — the flat hexbin heatmap lifted into a rotatable
  KDE surface, one peak per target. Height is how densely your arrows cluster
  there: the summit is your true point of impact, and a broad or twin-peaked
  mountain reveals a loose or stringing group the flat colours hide.
- **Dispersion cone vs distance** — your 95% group footprint drawn as a ring at
  each distance and stacked into a cone. Because dispersion is angular, the ring
  grows roughly linearly with range, so the cone visibly widens — this is the
  exact geometry the performance forecast integrates over. A second, fainter
  cone shows a reference archer at your current handicap for comparison.
- **History core-sample** — every hit plotted at (left/right, up/down, time), so
  each session is a horizontal disc and reading up the column shows your whole
  history drift and tighten. Colour runs teal (early) to purple (recent).
- **Score landscape** — expected points per arrow across distance *and* handicap
  for your most-shot face, rendered as terrain, with a gold marker for where you
  stand now. The trade-off surface behind the expected-score reports, made
  literal.

**Two animated Analyze replays (press play, or scrub).**

- **Group evolution** — steps through your sessions one frame at a time: the
  group appears, its centre (a teal cross) drifts, the 95% ring breathes, and a
  trail traces where your point of impact has wandered. Normalized by face size,
  so a mixed-target history all plays on one face.
- **Within-session playback** — replays your most recent session arrow by arrow:
  shots land one at a time, the running score climbs, and the group tightens
  then loosens as accuracy and precision update per end.

**Arrows that rain onto the predict face.** `/predict`'s Monte-Carlo already
simulated thousands of shots to build its score histogram, but you only ever saw
the histogram. Now the endpoint's face is drawn beside it and the simulated
arrows drop onto it as the run plays, so the abstract distribution has a picture:
you watch the group the prediction is describing actually form.

**A handicap line that draws itself on — and pings each class.** The dashboard's
handicap tile is now animated: the line sweeps on from your first completed
round to your latest (y-inverted, so improvement rises), the AGB classification
thresholds sit behind it as dashed guide lines, and a gold ping flashes the
first time your line crosses into each class you've earned. A record-status
class is marked in gold, the rest in blue.
