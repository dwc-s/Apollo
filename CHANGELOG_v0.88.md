v0.88 — The score earns its colour, and the pin is named

Tournament mode learns to run a **pin shoot**. USA Archery's achievement
programs — **JOAD** for juniors and the **Adult Achievement Program** —
hand out coloured pins for hitting a score at a set distance and target:
green, then purple, gray, white, black, blue, red, yellow, and finally the
Olympian medallions bronze, silver, and gold. Shoot a 30-arrow indoor or
36-arrow outdoor round, and the pin you earned is the highest colour your
score clears.

The selector now carries a **USA Archery — Pin shoots** section. Rather than
flood the page with every shootable combination, it folds them behind one
card per program × environment × bow type (Barebow/Basic Compound,
Recurve/Para Recurve Open, Compound/Para Compound/W1/Fixed Pins). Each card's
dropdown lists exactly the distance-and-target setups that bow type's chart
defines — JOAD indoor recurve offers 9m·60cm, 18m·60cm and 18m·40cm; the
compound outdoor card runs the full ladder of 80cm-full, 80cm-6-ring and
122cm faces from 15 to 50 metres. Pick one and shoot it on the canvas, or
hit **Enter scoresheet** to record a shoot you already finished on paper.

When the round completes — live, scoresheet, or practice card — Apollo names
the pin with its colour swatch and tells you how many points stand between
you and the next one up.

How it's built: each of the ~49 distance/target/equipment combinations is a
perfectly ordinary fixed round under the hood, so the whole existing
scoring, scoresheet, practice-card, and results machinery handles them with
no special cases. The only pin-specific code is the requirement table
(`_PIN_SOURCE`) and the lookup that turns a score into a colour
(`_pin_shoot_result`). Compound indoor scores inner-10 (the 40cm compound
face, X-ring only for 10); compound outdoor 6-ring uses the 80cm 6-ring face,
exactly as the matrices footnote.

The numbers were the work. USA Archery publishes the requirements only as
chart *images*, three equipment columns deep with multi-row distance options
per pin — so every threshold was read straight off the matrices and verified
row by row against the source. The requirements follow the Rapids Archery
JOAD published matrices (rev. 2024-01-30).

Two deliberate non-features: pin shoots don't feed the Archery GB handicap
trend (they aren't AGB rounds — the running-handicap aggregation already
filters on its own recognised-round list), and age class isn't enforced. At
the bronze/silver/gold levels an archer is expected to shoot their age
class's distance and target; Apollo records whatever you pick but doesn't
police eligibility.

Tests: 39 pytest green. The pin lookup was checked exhaustively — every
score from zero to max across all 49 rounds — confirming the earned pin and
the next-pin-up are always consistent and that every threshold ladder rises
monotonically. Selector and completed-round views were rendered in a
standalone harness, since the page itself is login-gated.
