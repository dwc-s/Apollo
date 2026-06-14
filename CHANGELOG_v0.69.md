v0.69 — One less tool

The Tools page dropped the Slope compensator. It applied the rifleman's rule —
aim for the horizontal component of a slant shot — which is a reasonable rule of
thumb for a bullet but a poor fit for an arrow's loopier trajectory, and the
single angle/distance input gave no sense of how rough the approximation is. It
was the weakest of the six calculators and risked sending people to the wrong
hold, so it's gone rather than left to mislead.

- **Slope compensator removed** from the Tools page — both the panel and its JS.
- The page now hosts five client-side calculators (wind drift, sight-mark
  interpolator, spine selector, FOC, kinetic energy), and the route docstring
  says so.

Template + a one-line docstring change. No schema changes, no new dependencies.
The remaining tools are untouched.
