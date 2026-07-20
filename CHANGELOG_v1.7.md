v1.7 — The Precision consistency report stops pooling every distance and face together: each face × distance combination draws its own trace, and a new face/distance filter narrows the view

The *Precision consistency (trend)* report pools every shot into one per-day
R95 point. That's fine when you always shoot the same face at the same range,
but its precision number (R95) is normalized for *target size*, not for
*distance* — so a day that mixed an 18 m end with a 70 m one, or two different
faces, folded genuinely different groups into a single figure and the trend
could mislead. This release makes the report face- and distance-aware.

**Each face × distance combination is its own trace.** Instead of averaging
everything together, the report now finds the (face, distance) combinations in
your history and draws one smoothed line per combination — so *WA 40cm @ 18 m*
and *WA 40cm @ 50 m* are two separate, colour-coded traces with a legend, and
you can watch each one's tightness trend on its own terms. A per-combination
summary table lists each line's days, latest value, and how much it has moved.
When only one combination has enough history the report keeps its classic
single line with the ±1σ consistency band; when none is deep enough on its own
it falls back to the old pooled line, so nothing is lost for shorter histories.
(The overlaid multi-line view drops the per-line band on purpose — a dozen
overlapping bands would be unreadable — and caps at the twelve combinations
with the most shooting days.)

**A face + distance filter.** Two new multiselect pickers on the report — the
faces and the distances you've shot — let you narrow to just the combinations
you care about (leave them empty to include everything, exactly as before).
They work like the existing bow/arrow equipment picker: your selection is
remembered, honoured on the streamed report and in the CSV/Excel export, and a
"Filtered to …" caption records what you're looking at. Distances are
normalized so "18" and "18.0" collapse into one option.

Together these turn a single, sometimes-muddled trend line into a clean
per-combination comparison — and let you zoom in on one face at one distance
when that's the question.
