v0.90 — The narrow screen is honoured: the scorecards fold to a phone, and the report boxes sit back inside their walls

A pass over the pages that had never been told how wide a phone is. Everything
here is layout — no scoring, data, or behaviour changed — but on a 320–414px
screen several views were spilling past their containers, and now they don't.

**Tournament scorecards.** The practice scorecard's score grid carried desktop
border-spacing (10px between every cell) and roomy card padding, which on a
phone pushed the running-total and remove-end columns clean off the right edge.
The spacing and padding now tighten under 480px so the whole grid — every
column, including the × — stays on screen.

**Enter scores from paper.** This one was worse: the form sized itself to its
widest child (`max-width: max-content`), and the widest child is a six-arrow
scoring table, so the *entire* form grew to ~570px — dragging the competition
name, date and email fields off-screen with it. The form is now constrained to
the viewport, the label/field pairs stack, and the wide arrow grid scrolls
horizontally **inside its own card** instead of breaking the page. Six arrow
columns per end simply won't fit 375px legibly, so a scoped scroll is the
honest answer rather than shrinking the inputs to un-tappable boxes.

**Predict.** The endpoint selectors carry long option labels ("WA 720
(Recurve) — …") and had no width ceiling, so a single `<select>` stretched the
row 260px past the viewport. Capped at the container width; the option text
truncates natively.

**Tools — sight marks.** The `[Distance] [Mark] [×]` rows are a
`1fr 1fr auto` grid, but a bare number input refuses to shrink below its
intrinsic ~170px, so two of them plus the delete button overran by ~50px. A
`min-width: 0` on the inputs lets the tracks collapse to fit.

**Analyze — the report picker.** The reported bug, and the subtle one. The
clickable report boxes overran their panel on narrow phones. The report grid
steps 3 → 2 → 1 columns as the screen narrows, and the multi-column rules
correctly used `minmax(0, 1fr)` — but the single-column rule used a bare `1fr`.
A bare `1fr` is `minmax(auto, 1fr)`, and that `auto` floor grows the track to
the box's *min-content* width, which — because the box is `content-box` with
padding and a border — is ~15px wider than the container. So every box poked
past the panel's right edge. It only showed once the container got tight
(i.e. on an actual phone), which is why it hid on desktop. Fixed by matching
the other breakpoints: `minmax(0, 1fr)`. The same guard was applied to the
scoresheet's stacked meta fields, where an iOS date input is exactly the kind
of wide, unshrinkable child that trips it.

How it was checked: the app was driven live at 320, 375 and 414px, measuring
each element against its container (not just the viewport) since a box can
overrun its panel while the page itself still doesn't scroll — which is
precisely what was happening on Analyze. Every fix was re-verified against a
fresh render, not the injected test styles.
