v0.97 — The handicap stops flattering you: every score now rounds to the whole handicap Archery GB would award, not the one a step better

Apollo has always claimed its handicaps match the published Archery GB tables and
archerycalculator.co.uk. For scores that land exactly on a table value they did.
For every score in between — which is almost all of them — the number came back
one step too good.

**The off-by-one, and where it hid.** The AGB 2023 scheme turns a score into a
handicap by taking the *continuous* handicap that would predict that score and
rounding it to the worse (higher) whole number — you only earn the better
handicap by meeting its tabled score outright. The engine did the opposite:
it scanned for the *largest* handicap whose rounded-up table score still reached
your score, which quietly handed you the handicap one below the one you'd earned.
The single reference test that guarded this — a WA 1440 score of 999 mapping to
handicap 44 — happens to sit exactly on a rounding boundary, the one place the two
readings agree, so the mistake sailed straight through it. `handicap_from_score`
now computes ceil of the continuous handicap directly (the smallest whole handicap
whose unrounded expected score has dropped to your score), with a plateau step at
the extremes that also resolves the asymptotic perfect score.

**What it touched.** The per-round handicap is the seed for a lot: the handicap
trend, the "best three averaged" Archery GB figure, the goal projection, and every
classification. Because a class is met when your handicap is at or below its
threshold, a handicap one step low was enough to lift a borderline score into a
class it hadn't earned — on a WA 720 recurve card alone, 56 scores across the range
were being shown a class too high (a 249 badged Archer 2nd Class when it is really
3rd). All of them now land where the governing body puts them. Existing histories
will see most handicaps tick up by one and a few borderline classifications settle
back a tier; that is the correction, not a regression.

How it was checked: validated against `archeryutils` — the MIT-licensed reference
implementation co-authored by one of the scheme's authors, the same source Apollo's
handicap module already cites. Installed in a throwaway virtualenv and compared
score-by-score: the old engine disagreed with it on 1277 of the 1440 possible
WA 1440 scores, the corrected one agrees across the entire usable range (the only
residual gaps are absurd sub-14-point totals that map to handicaps off the 0–150
chart). End to end, Apollo's Archery GB classification now matches archeryutils'
`calculate_agb_outdoor_classification` exactly at every score. Two regression tests
were added to pin it: a set of deliberately *non-boundary* reference scores (1000→44,
950→47, 600→30, …) that the old code got wrong, and a sweep asserting the round-to-
the-worse-handicap invariant directly. `pytest` is green at 50.
