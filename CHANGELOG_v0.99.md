v0.99 — Four trigonometry calculators join Tools, including a drawn arrow-trajectory parabola; the drag-model elevation tool steps aside

The Tools page gains a set of quick geometry helpers for the range: how an
arrow arcs to the target, how a hair of bow-hand error blows up downrange, how
angles map to millimetres on the face, and how a group at one distance projects
to another. All four are pure in-browser math, live on every keystroke, and
follow the global metric/imperial toggle like the rest of the page.

**Arrow trajectory (parabola).** Enter your arrow speed and the target distance
and the tool gives the elevation angle to hit dead-on, how high the arrow arcs
above your line of sight, the time of flight, and how far it would drop if you
aimed straight at the target — with a live SVG plot of the arc drawn beneath the
numbers, so you can *see* the rainbow. This is the idealized, drag-free model —
a true parabola, `θ = ½·asin(g·D/v²)` with the arc `y = x·tanθ − g·x²/(2v²cos²θ)`
— so it reads as a floor: a real arrow, fighting air, always drops a little more,
especially at distance. Speed can be estimated with the Arrow speed tool already
on the page.

**Bow-hand error → deviation.** A tiny error at the bow is a big miss downrange,
and this tool puts a number on it. The bow hand is the front pivot: shift it
sideways by a fraction of a millimetre and the shot's launch line rotates about
your anchor, and that angle is magnified all the way to the target. Enter the
error, your lever arm (roughly the draw length, defaulting to a 28″ / 711 mm
draw), and the distance, and you get the miss at the target, the plain
amplification factor (`distance ÷ lever-arm` — "1 mm at the bow → N mm at the
target"), and the equivalent angular error. It generalizes to any launch-point
error — nocking point, release, sight — not just the bow hand.

**MOA / mrad + sight clicks.** The bread-and-butter angular converter: turn an
angle into the distance it covers on the target and back again (1 mrad subtends
the distance ÷ 1000, so 70 mm at 70 m; 1 MOA ≈ 0.291 × distance in mm, so ≈29 mm
at 100 m), and work out how far a single sight click of a given MOA or mrad value
moves your group at that distance.

**Group → dispersion projection.** Feed in a group you actually shot — its size
at the distance you shot it — and the tool reports it as an angular dispersion in
MOA and mrad, then projects the group you'd expect at another distance if your
form held. It's pure geometry (`projected = group × new-distance ÷ old-distance`),
so it's a best-case floor; real groups grow a bit faster with distance as drop and
wind add up.

**The Bow-hand elevation tool has been retired.** Its drag-integrated launch-angle
solver (added in v0.87) tried to be a full ballistics model — RK4 trajectory,
air density from temperature and elevation or a live weather lookup, a fletching
drag preset — and the accuracy of the absolute angle never justified the
complexity. The new trajectory parabola covers the same "how high do I aim"
question in a form that's honest about being an idealization, and pairs it with a
picture. The weather lookup it once used lives on independently in the session
conditions widget, so nothing else changes.
