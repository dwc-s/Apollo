v1.0 — The performance forecast learns your fuzzy factor: it calibrates to what you actually score, not just the geometry

Apollo's predictor has always been honest geometry — fit the angular spread of
your groups, then simulate whole tournaments arrow by arrow. But geometry
doesn't know about the things that quietly cost points on the day: nerves at
full draw, a gust you read late, the tenth end of a long round, the occasional
flier the Gaussian never sees. This release teaches the forecast to account for
them, and cleans up a few rougher edges around it.

**The fuzzy factor.** Tick one box on the Predict page and the forecast stops
being pure trig and starts matching your real self. Apollo pools every scored
end you've ever logged, scores your actual arrows against each face, and
compares the total to what the fitted model predicts for those same faces and
distances — a server-side Monte-Carlo of the very same fit the simulator uses.
The result is a single, scale-free number: "you shoot about 85% of what the pure
trig says." Because the angular model already handles distance on its own, that
residual is distance-agnostic — so the one coefficient applies to *any* face at
*any* range, including rounds and distances you've never shot. It's shrunk
toward 1.0 when you've only logged a handful of scores, and clamped so a couple
of bad days can't wreck it. As the simulation runs, a second "Calibrated"
histogram grows in real time right beside the raw model one, so you can see
exactly how far reality sits from the geometry — and the note spells it out:
"learned from N scored sessions — you shoot about X% of the pure-trig
projection." It's opt-in, and if you've barely scored anything it simply says so
rather than guessing.

**Editing a past session** now does everything the live session page does. The
weather fields finally carry visible labels — Temp, Wind, Gust, Wind dir,
Humidity, Pressure — instead of placeholder ghosts that vanished the moment a
value was filled in. And, new, the bow's per-outing gear and tuning (clicker,
plunger tension, brace height, aim method — whatever your bowstyle exposes) can
be corrected after the fact from the edit form, validated against the bowstyle
schema and written across every shot in the session exactly the way the live
page records it on the way in.

**Retired: the arrow-trajectory parabola.** The drag-free trajectory calculator
that joined Tools in v0.99 has stepped aside. The other nine geometry helpers —
wind drift, sight marks, spine, FOC, arrow speed, kinetic energy, bow-hand
error, MOA/mrad, and group→dispersion projection — all stay, and the shared
metric/imperial toggle they rely on is unchanged.

**Small print.** Hover tips now explain the less-obvious numbers where they'd
otherwise sit unexplained: the percentiles (P10/P50/P90), the angular σ in
milliradians, and what "endpoint" means on the Predict page, plus the handicap
and classification headings on Records. They join the glossary already built
into Analyze and the tips scattered through the session and tournament pages.
