v1.4 — Session headers gain start time + face, six trend charts go chart-first with a fold-away table, the two expected-score reports learn your fuzzy factor, and the Analyze palette, spread-violin orientation, and within-session drift are all set right

A batch of readability and correctness fixes across the session list and the
Analyze reports — most of them things that only started to grate once there
was enough history to notice. Nothing here changes how a shot is scored; it's
about surfacing what's already recorded more honestly and reading it more
easily.

**Previous-session details show when you shot and on what.** The header on a
past session used to carry only the date and duration. It now also shows the
**start time** (localized to your timezone, so a late-evening session doesn't
drift onto the wrong day) and the **face** you shot at, so a session is
identifiable at a glance without opening it — useful once you're shooting the
same round on several faces.

**Six trend charts go chart-first, with the data table folded away.** Arrows
shot vs time, the accuracy & precision traces, Precision consistency, Biggest
vs smallest spread per quiver, the horizontal & vertical spread violins, and
Within-session drift all led with a wall of table rows before you reached the
picture. The chart now sits **above** the table and is enlarged to fill its
container, and the underlying data table is **collapsed by default** behind a
disclosure — one tap when you want the numbers, out of the way when you don't.

**The two expected-score reports learn your Fuzzy Factor.** *Expected
points/arrow vs distance* and *Expected score from fit* projected pure
geometry: what your group *should* score if trigonometry were the whole story.
But nerves, wind, fatigue, and the occasional flyer mean real scores sit a
little below that. `/predict` already calibrates for this with a single
scale-free coefficient — your actual scored results divided by what the model
predicted, pooled across all your history — and now these two Analyze reports
do too. Each draws **both traces**: the raw geometric projection and the
calibrated one, so you can see the model's ceiling and your realistic number
side by side (the calibrated line only appears once there's enough scored
history to trust the factor).

**One palette across the Analyze charts.** Following v1.3's teal-accuracy /
purple-precision scheme on the traces chart, the rest of the Analyze reports
now match it, so a colour means the same thing wherever you are. Three charts
keep their own logic on purpose: **Hits by boundaries** samples its bars from
the target face, the **Shot density heatmap** keeps its warm density ramp, and
**Expected score from fit** stays as it was.

**The spread violins point the intuitive way.** On *Horizontal & vertical
spread (violins over time)*, horizontal spread had been drawn on a vertical
violin and vertical spread on a horizontal one — backwards from what the labels
led you to expect. The orientation is swapped so horizontal spread reads
horizontally and vertical spread vertically.

**Within-session drift stops flattering later quivers.** The old chart pooled
every shot by its quiver position across all sessions — 1st quivers together,
2nd quivers together, and so on — then plotted accuracy and precision against
position. The trap: fewer sessions reach the higher quiver numbers, and pooling
groups from different sessions around one shared centroid makes precision look
tighter purely as the sample thins, so the metric appeared to *improve* late in
a session no matter what you actually did. It's rebuilt around a **paired
within-session baseline**: each session is its own control, quiver 1 is its
zero, and every later quiver is measured as a *delta* from that session's own
start (mean miss for accuracy, mean radius for precision), then those deltas are
averaged across every session reaching each position. Between-session level
differences — including the pooled-centroid inflation — cancel out, so the trend
now reflects genuine within-session drift alone: warm-up gains and late-session
fatigue, not survivorship. A position needs at least two sessions to plot.
