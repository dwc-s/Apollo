v0.87 — The bow hand learns its elevation, and the sky is asked its weight

A new calculator joins the Tools page: **Bow-hand elevation**. Given a shot —
distance, height difference, arrow speed, mass, and shaft diameter — it solves
for the launch angle that lands the arrow on target, and, more usefully, the
degrees you raise or lower the bow hand *between* two distances: the change that
builds a sight tape.

This is the honest version of a feature that was tried and pulled before. A
*Slope compensator* card shipped early and was removed in v0.69 because it leaned
on the rifleman's rule — a flat-shooting approximation that fits a bullet better
than an arrow's loopier arc. The new tool doesn't approximate the trajectory; it
integrates it. A fourth-order Runge–Kutta marches the arrow through gravity and
quadratic drag in the vertical plane, and a bisection finds the angle whose arc
passes through the target. Setting drag to zero collapses it exactly onto the
textbook vacuum angle-of-reach — checked to four decimals — which is how we know
the integrator and the solver agree.

Three deliberate choices keep it usable rather than merely correct:

- **Every field toggles metric/imperial.** Distance, height, and elevation in
  m/ft; speed in m/s or fps; mass in g or gr; shaft OD in mm or in; temperature
  in °C or °F — all following the global `⇄` switch. The computed angle is
  invariant across the toggle, as it must be.

- **You never type an air density.** Nobody knows theirs. Instead you give
  temperature and elevation and the tool computes density from the dry-air ISA
  barometric model — or, if you tap **Use my location**, it pulls live
  temperature, *measured* surface pressure, and humidity for your coordinates
  and computes density from the real reading (more accurate than estimating
  pressure from altitude). At Boulder's 1,650 m, that's 0.965 kg/m³ against sea
  level's 1.225 — a 21 % difference the arrow genuinely feels.

- **You never guess a drag coefficient.** A fletching dropdown — bare shaft,
  low-profile vanes, standard 2″, large field vanes, feathers — maps to an
  effective Cd, with a Custom escape hatch. The presets are approximate, so the
  tool steers you toward the distance-to-distance *change*, which is far less
  sensitive to that guess than the absolute angle.

The location lookup is opt-in: nothing leaves the browser until you click, and
then only rounded coordinates go to Open-Meteo (free, no API key), which is
credited under the tool. Everything else on the page stays same-origin and works
offline.

Bugs caught and fixed during review of the new code:

- **The location lookup would have been dead on the live site.** The site's
  Content-Security-Policy pins `connect-src 'self'`, which silently blocks the
  cross-origin fetch — it only worked in a CSP-free test harness. `connect-src`
  now allowlists `https://api.open-meteo.com`, and the header comment documents
  why.

- **Steep shots wrongly read "out of range."** The angle scan was clamped to
  −45°…70°, so a steep field/3D shot — a target well below or above the
  archer — fell outside the search band and reported out-of-range even with
  speed to spare. The band is now −80°…85°; a 40 m drop at 15 m resolves to a
  −68° bow hand as it should.

- **A downhill arrow that arrives faster** than it launched (gravity adding
  kinetic energy on the way down) printed a malformed "−-4 % loss." It now reads
  "+4 % gain."

- **The location status line went stale** on a later units toggle, showing °C
  next to a field switched to °F. It no longer prints the temperature (which
  lives in its own field); pressure and humidity, being unit-agnostic, stay
  correct.

Tests: 39 pytest green; the change is client-side plus a one-line CSP allowlist,
and `apollo.py` parses clean. The physics was verified by evaluating the formulas
directly — vacuum limit against the closed form, air density against ISA and the
moist-air relation — and the UI in a standalone harness of the panel, since the
page itself is login-gated and only re-renders the same numbers.
