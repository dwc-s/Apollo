v0.75 — Paper cards keep their kit, out of the prediction

A scorecard records *what you scored*, not *where each arrow landed*. To make
the ring values scoreable, Apollo writes each arrow to a synthetic spot — dead
on the horizontal line, at the middle of its ring. Useful for tallying a round;
poison for the predictor, which reads those spots as if they were real groups
and "learns" a sideways bias and a flat vertical spread that never happened.
This release keeps scorecards out of the fit, and — now that it's safe to —
lets a scorecard carry the bow, arrow and gear you shot it with.

- **/predict ignores scorecards.** The performance-prediction fit now skips any
  shot entered from a scorecard — competition score sheets and paper practice
  scorecards alike. Only real plotted shots shape the 2D dispersion fit and its
  distance trend, so a logged round can't inject a phantom bias or collapse the
  vertical spread. A single scorecard distance no longer quietly enables a
  distance-trend regression on fictitious data, either.

- **Scorecards carry their equipment.** Both scorecard forms gain a collapsible
  "Bow, arrow & gear (optional)" menu — the same bow selector, bowtype-specific
  tuning fields, effective draw weight and arrow picker the live session screen
  uses, collapsed by default. On the competition score sheet each competitor
  card gets its own menu; the single-archer practice card gets one. Fields
  prefill to the bow's saved gear and last-used values, exactly like a live
  session.

- **Stored like a real session.** What you pick is snapshotted onto every row of
  the card through the same path a plotted shot uses, so the bowtype settings
  (static gear overlaid with this card's dynamic tweaks) land in the usual JSON
  column. /analyze head-to-heads and per-bow handicap views can now see the kit
  behind a logged round; the equipment is optional, and a blank menu stores
  nothing.

Internally: scorecard rows are detected by the `match:` tag every scorecard
already carries (the same marker `_counts_toward_handicap` keys on), so the
exclusion in `_fit_shot_distribution` is independent of equipment — adding gear
data doesn't let those rows back into the fit. The coordinate system is
deliberately untouched. The competition sheet's per-participant menu is a scoped
clone (`_bow_style_settings.html` assumes a single `id="bow"`, so it couldn't be
reused per card); the practice card reuses the shared include directly. Both
submit paths now route through the canonical `_insert_shot()` rather than a
hand-rolled INSERT, so the bow/arrow/style snapshot stays in one place. No schema
changes, no new dependencies.
