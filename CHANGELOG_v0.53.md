v0.53 — Tools featureset · head-to-head mutual exclusivity · auto end-session

- **New Tools page (`/tools`).** Seven client-side archery calculators on one page, each in its own collapsible card (collapsed by default, native `<details>`/`<summary>`):
  - **Wind drift.** Drag-based lateral drift model: `F = ½ρv²·C_d·(L·d)`, `drift = ½(F/m)·t²`. Inputs include arrow mass, shaft OD, arrow length, mean wind, peak gust, wind angle, arrow speed, distance. Gust handling exploits the wind² scaling in the drag formula — a 1.5× gust drifts 2.25× the mean — and the result splits into "drift at mean wind" and "drift in peak gust" with the gust factor and drift multiplier shown. Shaft OD displays in either inches or mm following the global `⇄ Imperial/Metric` toggle in the side nav. Heavier and skinnier shafts visibly drift less; a steady-wind result falls out by setting peak gust = mean wind.
  - **Sight marks.** Piecewise-linear interpolation across N known distance/mark pairs; extrapolates beyond the known range using the nearest segment's slope and flags the result as extrapolated.
  - **Arrow spine selector.** Easton-style adjusted bow weight (±5 lbs/in arrow length, ±1.5 lbs per 25 gr point weight, bow-type correction) → spine recommendation band.
  - **FOC.** Standard ATA `((balance − L/2)/L)·100` with low/target/hunting/EFOC band chips.
  - **Arrow speed (fps).** Two methods:
    - **Bow specs (any bow type)** — energy-storage model `v = √(2·η·k·F_peak·stroke / m)` with bow-type-tuned `k` (force-draw-curve area fraction) and `η` (mechanical efficiency). Works for recurve, compound, and longbow alike from peak draw weight, draw length, brace height, and arrow mass.
    - **IBO/ATA rating (compound)** — standard delta-from-rating: −2 fps/lb under rating, −10 fps/in under rating, −1 fps per 3 gr over rating, −1 fps per 3 gr of string accessories.
  - **Kinetic energy & momentum.** `KE = mv²/450,240` (ft·lb), `momentum = mv/225,400` (slug·ft/s).
  - **Slope compensator.** Rifleman's rule for arrows: aim for `slant × cos(angle)`, displays hold-off delta.

- **Head-to-head filters mutually-exclusive pairs only.** `/analyze`'s head-to-head report now skips any bow/arrow/tag pair that has ever been used in the same session — a head-to-head only tells you something useful when the two sides are mutually exclusive. New `_cooccurring_pairs(user_id, kind)` helper builds the cooccurrence set; the per-kind comparison loop drops pairs in that set before any stats are computed.

- **End-session auto-redirect.** The session-stats screen now bounces to the splash 7 seconds after rendering. No countdown copy in the UI.

- **Tools nav link.** Added "⚙ Tools" entry to the side nav across all 18 templates that carry side-nav markup.
