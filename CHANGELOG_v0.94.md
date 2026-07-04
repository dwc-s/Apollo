v0.94 — The biggest-vs-smallest spread chart learns the accuracy traces' manners: solid lines told apart by colour, labelled where they end, and a quiet trend through each

A small visual-consistency pass over one Analyze report. No new data, no
migrations, no change to how spread is computed — only how the "Biggest vs
smallest spread per quiver" chart draws itself, brought in line with the
accuracy/precision traces so the two read the same way.

**The two spread lines are now told apart by colour alone.** The biggest-pair
trace was already a solid blue line, but the smallest-pair trace leaned on a
second channel — square markers — to set itself apart. Both are now solid lines
with the same subtle round dots; colour (blue = biggest pair, amber = smallest)
is the only thing that distinguishes them, matching the accuracy/precision
chart's rule that one channel carries the difference.

**The legend is gone; each trace names itself in place.** Instead of a key in the
corner, each line is labelled at its own right edge in its own colour, with the
same vertical nudge the accuracy chart uses so the two labels never sit on top of
each other.

**The date markers are quieter.** The per-quiver dots shrank from a size-4 marker
with an edge to a size-2.5 edgeless one, so they mark where each quiver sits
without competing with the line itself.

**Each trace carries a faint trend line.** A same-colour linear best-fit is drawn
behind each series at low opacity, so whether your worst pair and your tightest
pair are trending together or apart reads at a glance. The trend is skipped for a
single-quiver history, where a line of best fit has nothing to say.

The shaded band between the two lines — the within-quiver gap — stays, now as a
quiet backdrop rather than a legend entry. The report's intro copy was updated to
describe the new encoding.

How it was checked: `pytest` stays green at 48. The plotting block was rendered
in isolation against synthetic histories and the SVG inspected: a ~20-quiver
series drew both solid traces, the two right-edge labels in their trace colours,
the subtle dots, and both faint trend lines over the retained band. Degenerate
inputs were exercised without error or numpy warning — a single quiver (trend
correctly skipped), an all-equal series where biggest and smallest coincide, an
all-zero series, and a final-quiver tie where the two end labels share a y.
