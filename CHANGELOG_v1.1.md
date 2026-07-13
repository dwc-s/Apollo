v1.1 — A new Precision consistency report tracks your group tightness day by day, the Analyze glossary becomes a right-hand sidebar, and the accuracy/precision traces shed their per-quiver lines

Precision — how tightly your arrows cluster around their own centre, regardless
of where that centre sits — is the thing tuning and execution move. But a single
R95 is a snapshot; what you usually want to know is whether it's *trending* the
right way, and how steady it is from one outing to the next. This release adds a
report built to answer exactly that, reworks how the Analyze page hands you its
definitions, and trims a granularity that was adding more ink than insight.

**Precision consistency (trend).** A new Analyze report plots your R95 over time,
one point per day of shooting — every shot that day, across all its sessions,
pooled into a single group. The raw day-to-day figure is jumpy, so the headline
is a trailing five-day moving average: responsive to a real change in form,
unlike the cumulative all-time line in the traces report, which barely moves once
your history is long. Around it sits a shaded ±1σ band — the spread of your daily
R95 across each five-day window. A *narrowing* band is the quiet win: it means
your precision itself is becoming more consistent, even when its level hasn't
shifted. Faint dots show the raw daily figures behind the smoothing, and it's
available as a home-dashboard tile too. Everything is normalised by target
half-width, so mixed faces and distances compare fairly; days with fewer than six
scored hits are skipped.

**The glossary moves to a sidebar.** The "what the numbers mean" reference on
Analyze used to be a collapsible strip wedged between the report picker and your
results. It's now a fixed right-hand rail that stays put as you scroll through
the reports, so a definition is always a glance away instead of a
scroll-and-expand. On narrower screens it folds back into the normal flow as a
full-width panel, so nothing gets squeezed.

**Accuracy & precision traces slims down.** The combined traces chart offered
three granularities — per session, per quiver, and an all-time rolling pool. The
per-quiver traces are gone; they added a lot of ink for a signal the per-session
and all-time lines already carry more legibly. The chart is now up to four lines
(accuracy and precision, each per session and all-time), and the per-session
table keeps its quiver *count* column.

**Small print.** Right-edge column tooltips on the Analyze tables no longer run
off the side of the table — the two rightmost headers now open their tips
leftward instead of into the void. And the shot-cloud time series that feeds
these reports learned to group by calendar day, not just by session.
