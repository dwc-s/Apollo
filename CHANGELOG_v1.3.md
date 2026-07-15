v1.3 — The accuracy & precision traces are rebuilt for legibility: a teal/purple palette, a legend grouped by metric, per-session and all-time lines you can finally tell apart, and the quiver-spread chart brought in line

The combined accuracy & precision traces pack a lot onto one date axis —
accuracy and precision, each at two timescales, optionally split across several
bows, arrows, or tags at once. It had quietly become hard to read: the lines sat
in similar shades, every one carried its own label crowded against the right
edge, and the per-session and all-time versions of a metric blurred into each
other. This release is a legibility pass over that chart (and the closely
related quiver-spread one), with no change to the underlying numbers.

**A palette that separates the two families by hue.** Accuracy traces are now
drawn from a teal ramp and precision from a purple one, so which family a line
belongs to reads at a glance instead of from its label. In head-to-head mode the
same logic carries the comparison: each selected bow / arrow / tag is a distinct
shade *within* its family — accuracy stays teal, precision stays purple —
rather than every subject being one arbitrary color spanning both metrics.

**A real legend, grouped by metric.** The per-line labels that used to jostle for
space at the right edge are gone, replaced by a legend set just outside the
chart. Its entries are grouped under bold **Accuracy** and **Precision**
headings with the traces indented beneath, so the key mirrors how you actually
think about the chart. Trend lines get their own foot-of-legend entries.

**Per session vs all-time, told apart by texture — not just shade.** Within a
family the two timescales share a hue, so they're now separated by texture: per
session is a bold solid line with date dots (the measured signal), while all-time
rolling is a two-color dashed line — the family shade alternating with a pale
tint of itself — an unmistakably different stroke even where the two cross. Their
straight trend lines split by timescale too: **gold** for per session, **black**
for all-time rolling, so the short-term and long-term directions never blur
together. In head-to-head mode the skill-adjusted companion line moved to dotted
to stay distinct from the now-dashed all-time line.

**The quiver-spread chart follows suit.** "Biggest vs smallest spread per quiver"
gets the same treatment: a teal line for the biggest pair, purple for the
tightest, a legend in place of inline labels, and a gold trend line for each.
(The tightest-pair line had to leave its old amber, which would have clashed with
the new gold trend.)
