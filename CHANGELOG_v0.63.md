v0.63 — Head-to-head that actually compares, and a leaner analyze

The analyze page had grown a few reports that answered questions nobody was
asking, and its flagship comparison — "Head-to-head" — was quietly refusing
to compare the very equipment people most wanted to pit against each other.
This release fixes the head-to-head, prunes the dead weight, and teaches the
accuracy/precision timeline to run head-to-head too.

- **Head-to-head no longer hides real comparisons.** The report disqualified
  any bow / arrow / tag pair whose two sides had *ever* been logged in the
  same session, on the theory that a fair A-vs-B needs the two to be mutually
  exclusive. In practice that dropped exactly the pairs archers care about —
  two arrows shot side by side, or two tags applied to overlapping sessions —
  and then reported the misleading "pairs had too few hits for a t-test." The
  co-occurrence guard is gone: shooting A and B in the same session is a
  *controlled* comparison, not a disqualifier. Two arrows with hundreds of
  shots each now produce a panel instead of an empty card.

- **Accuracy & precision traces can go head-to-head.** Tick which of the six
  traces to plot (per-session / per-quiver / all-time × accuracy / precision),
  then optionally pick one or more bows, arrows, or tags to overlay them on
  the shared timeline. Each subject gets its own color; marker shape is the
  metric and line style is the granularity. With nothing selected the report
  is unchanged — one combined set of traces for every shot. The CSV/Excel
  export gains a Subject column when subjects are in play.

- **Three reports removed.** "Accuracy over time", "Accuracy & precision by
  draw weight", and "Sessions per day" are gone, along with their backing
  code. The accuracy/precision traces report already covers the timeline view
  more clearly, and the draw-weight and sessions-per-day cards weren't earning
  their space.

No new runtime dependencies, no schema changes.
