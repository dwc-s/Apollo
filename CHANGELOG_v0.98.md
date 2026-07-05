v0.98 — Accuracy stops flattering a scattered group, the spread of your shots gets its own shape, and the home page becomes yours to arrange

Three changes this release: a sharper definition of "accuracy", a new violin
report for how your groups spread left/right and up/down over time, and a home
dashboard you can rearrange to show exactly what you care about.

**Accuracy now counts the spread, not just the centre.** Apollo has always split
the two error modes apart — accuracy (where the group sits) and precision (how
tight it is). But "accuracy" was measured as **MPI**: the distance from the
bullseye to the group's *centroid*. That has a blind spot. A quiver sprayed all
over the face but balanced around the middle averages out to a centroid on the
gold, so MPI called it near-perfect — a shotgun pattern read as bullseye-accurate.
Accuracy is now the **mean distance of each arrow from the gold** (`mean_miss` in
`_archery_stats`): every arrow's miss counts, so a loose group scores poorly even
when it's centred. A tight group off to one side and a wide group around the
middle are both, correctly, less accurate than a tight group in the ten.

*Where it changed.* Everything that *tracks* accuracy as a number now scores on
mean miss: the accuracy/precision traces, within-session drift, performance-vs-
conditions, the "most accurate quiver" record, and accuracy goals. MPI hasn't
gone anywhere — it's still shown as the group's **bias** (the centroid offset and
the direction to move your sight) on the per-target and per-quiver stat panels,
and it still drives the head-to-head and cold-bore centroid tests (Hotelling's
T²), which are genuinely about where the group sits. Existing histories recompute
from your raw shots, so records and goal progress will shift to the new metric —
that's the correction, not a regression.

**Violin plots of horizontal and vertical spread over time.** A new `/analyze`
report, *Horizontal & vertical spread (violins)*, shows the *shape* of your
scatter rather than a single number. For every completed quiver it takes each
arrow's offset from that quiver's own centre — so it's pure grouping, with aim
bias removed — and pools those offsets per session (or per month once you have a
lot of them). The top row is horizontal spread with time on the x-axis and the
offset in centimetres on the y; the bottom row is vertical spread with the axes
flipped, time running down the y-axis. A fatter violin is a looser group on that
axis, and a faint ±1σ envelope traces the trend so you can watch a group tighten
(or drift) over a season. Values are physical centimetres — a 5 cm group reads as
5 cm on any face. It carries the same date-range, equipment and tag filters as the
other reports, and a CSV/Excel table of σ and IQR per bucket.

**A home dashboard you arrange yourself.** The signed-in splash used to be a fixed
row of cards. It's now a drag-and-drop grid: hit **Edit dashboard** to move and
resize tiles, **Add widget** to drop in anything from the catalogue, and **Save**
to keep the layout (stored per account). Choose from stat cards (arrows shot, time
on the line, current and longest streak, days since last shot, handicap,
classification, most-accurate and most-precise quiver, active goals), the goals
list and equipment service alerts, or embed live graphs — handicap over time,
accuracy & precision, the shot-volume calendar, arrows over time, and the new
spread violins. Graph tiles load after the page so the home screen stays quick,
and the grid folds to a single column on a phone. Your first visit starts from the
familiar default layout, so nothing changes until you decide to move things around.
