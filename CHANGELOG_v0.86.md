v0.86 — The momentum reads true, the spine chart stops doubling back

A pass over the standalone calculators on the Tools page turned up two small
numeric faults. Neither touches a scored shot, a handicap, or a report — the
core scoring and statistics math was checked end-to-end and stands — but the
Tools page is what an archer reaches for when tuning a setup, so the numbers it
prints should be right to the last digit.

- **Momentum now uses the published constant.** Kinetic energy & momentum
  divided arrow momentum by 225,400, which quietly assumes g = 32.2 ft/s². The
  canonical archery divisor is 225,218 — 7000 grains/lb × 32.174 ft/s² (standard
  gravity) — and matches the kinetic-energy line right above it. Every momentum
  figure was reading about 0.08 % high; it now reads true (400 gr at 280 fps →
  0.497 slug·ft/s).

- **The spine table steps cleanly again.** One band in the spine selector
  (`340–400`) kept the upper bound of the band above it and dropped its lower
  bound below it — an overlapping, out-of-order rung that could recommend a
  too-stiff range as adjusted weight climbed. It's now `340–370`, so the whole
  ladder decreases monotonically with no overlap.

Above the floor: the splash page finally lists the **Tools & calculators** among
its features — six client-side calculators (wind drift, sight marks, spine, FOC,
arrow speed, KE & momentum) that had a side-nav link but no entry in the feature
list. The README's momentum formula and the generated HTML docs were rebuilt to
match.

Tests: 39 pytest green. Both fixes are pure client-side arithmetic and were
verified by evaluating the exact formulas (momentum 0.497; spine ladder
monotonic) rather than through the login-gated page, which only re-renders the
same numbers.
