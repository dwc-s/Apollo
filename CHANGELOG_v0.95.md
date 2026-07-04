v0.95 — Expected score learns that distance matters: each face is fit per range, a new graph traces the drop-off, the projection stops wobbling, and yards typed anywhere are stored as metres

A correctness pass over the expected-score projection plus a new Analyze
report, and a quiet fix that makes the whole app honest about distance units.
The point value of an arrow still depends only on where it lands on the face —
distance never changes what a ten is worth — but *how tightly you group* grows
with distance, and the projection now respects that.

**Expected score is now fit per distance, not per face.** The "Expected score
from fit" report used to pool every shot at a target face into one
bivariate-normal fit, no matter the range — so a 122 cm face shot at both 18 m
and 70 m blended a tight indoor group with a loose outdoor one into a fictional
middle spread that described neither. Each (face, distance) is now fit on its
own, one panel per distance, titled `{face} @ {n} m`. A face shot at a single
distance renders exactly as before; shots with no recorded distance form their
own clearly-labelled panel instead of contaminating the real-distance fits. Each
distance keeps its own ≥10-hit threshold and its own empirical miss rate.

**A new report graphs expected points per arrow against distance.** "Expected
points/arrow vs distance" lays every face's per-distance projection on one axis
— one line per scoring face, a marker at each range, annotated — so the
drop-off is visible at a glance: a steep line means distance costs you
disproportionately, a flat one means your form holds. It reuses the same
per-distance fit as the expected-score report, with a table (target, distance,
expected pts/arrow, max, % of max, hits) for download.

**The projection stopped wobbling.** The Monte-Carlo integration is now seeded
with a fixed value, so repeat renders of a report are byte-identical and the
expected-score report and the new vs-distance graph agree exactly on the same
(face, distance) instead of drifting by a percent of sampling noise. The shared
draw across distances also acts as common random numbers, which smooths the
drop-off curve. The fit itself was pulled into one shared helper so both reports
compute it the same way.

**Distance is stored in metres, wherever it's entered.** The Imperial toggle
relabels the distance field "yards" but nothing converted it, so an Imperial
entry landed raw yards in a column the reports and `/predict` read as metres.
Both distance-entry pages — the scorecard and the edit-session form — now keep a
hidden canonical-metres field beside the visible one and convert on input and on
unit toggle, so yards typed in Imperial mode become metres before they reach the
DB, submit, or the offline queue. The conversion lives in one shared
`static/apollo-units.js` instead of being copied into each template. No historic
data needed migrating — every distance ever recorded was already metric.

How it was checked: `pytest` stays green at 48. The per-distance split was run
against real multi-distance histories — a 40 cm face shot at 18/30/50 m now
projects 4.80 / 3.01 / 1.01 pts/arrow instead of one pooled ~3.x — and the
vs-distance SVG was rendered and inspected. Seeding was verified by re-running a
report twice (identical) and cross-checking the two reports agree on shared
groups. The unit conversion was driven end-to-end in a real browser on both
pages: 20 yd typed in Imperial mode stores 18.29 m, the `FormData` submit and the
offline `getElementById('distance')` read both carry metres, and toggling back to
metric shows 18.29 without re-conversion drift. The shared JS was confirmed served
by Flask and its `window` helpers exercised from the served file.
