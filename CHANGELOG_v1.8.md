v1.8 — Units go per-field: a little ⇄ button beside every measurement on the equipment and target forms flips just that kind of unit — length, weight, diameter, draw weight, target size — independently, and shaft weights now default to grains

Apollo has always had a single Metric/Imperial button in the side nav, but it
only ever converted a handful of fields, and it flipped everything at once —
you couldn't keep arrow length in inches while reading weights in grains. This
release replaces that on the equipment and target forms with a small unit
button next to each measurement field.

**A toggle on every measurement field.** On Add / Edit arrow, Add / Edit bow,
and Edit targets, each unit field now carries its own little button showing the
current unit — click it to switch. The forms cover arrow length, shaft / tip /
nock weight, shaft diameter, bow draw weight and effective draw weight, bow
(AMO) length, and target physical size.

**Each kind of measurement switches independently, and is remembered.** Weight,
length, diameter, draw weight, and target size each keep their own unit choice —
so you can enter draw weight in kilos while length stays in centimetres, and the
choice sticks the next time you open the form. Flipping one weight field flips
every weight field on the page together, so a form stays internally consistent.

**Shaft weights default to grains.** Arrow shaft, tip, and nock weights now read
in grains by default — the unit archers actually use — with grams a click away.
(Draw weight offers lb / kg, lengths cm / in, diameters and target sizes mm / in.)

**Nothing changes in your saved data.** Each field still stores exactly the same
canonical value it always did (inches for length, grams for weight, millimetres
for diameters and target sizes, pounds for draw weight), so existing equipment
and every report that reads it are untouched — the button only changes how the
number is shown and typed, converting back on save. Existing weights entered in
grams simply display in grains now (the same physical weight, one click to flip
back).

The session distance field keeps its own metres/yards toggle, and the scoring-
zone editor, the calibration wizard, and the display-only pages (Previous
sessions, Analyze, Records, Tools) keep the global side-nav toggle for now.
