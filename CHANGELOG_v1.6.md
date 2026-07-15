v1.6 — The shot-density mountain and dispersion cone now read in centimetres, and the 3D and animated report canvases are larger

A quick follow-up polishing the new interactive charts from v1.5.

**Centimetres, not millimetres.** The *Shot-density mountain* and *Dispersion
cone vs distance* labelled their left/right and up/down axes in millimetres,
which put awkward four-digit numbers on the scale (a full 40 cm face runs
−200…200). Both now read in **centimetres** — axis ticks, labels, and the
matching data-table columns (face width, KDE bandwidth, R95 σ) all switched
together, so the report is internally consistent. Distance stays in metres.

**Bigger canvases.** The 3D charts and the animated players were sized
conservatively. The 3D Plotly surfaces grew from 480 to **640 px** tall, the
animated shot players from a 340 to a **460 px** face, and the `/predict`
arrow-drop face from 300 to **380 px**, so there's more room to see the group
form and to rotate a surface without it feeling cramped.
