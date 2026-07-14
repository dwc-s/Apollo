v1.2 — Unfinished sessions can be completed or merged, a new tag manager deletes tags for good, head-to-head traces correct for your own improvement, and Performance vs conditions charts every weather element

Four changes this release, spread across the session list, the Account page,
and two Analyze reports — each one closing a gap that only showed up in ordinary
use.

**Complete or merge an unfinished session.** A session you started but never
ended used to read "Session incomplete" forever, with no way to close it out or
to fold a stray fragment back where it belonged (your phone died mid-round, you
restarted, and now there are two). The Previous sessions list now grows a
one-tap **Complete** button on any unfinished session — it stamps the end time
from your last shot. Editing a past session also gains proper begin / end /
manual-length fields, so you can set or correct the times by hand. And when a
fragment is really the tail of an earlier outing, **Merge into another session**
folds it in: it offers only sessions shot the same day at the same target and
distance (so the merged result stays internally consistent), moves the shots
across, combines the time span, and drops the empty leftover. Eligibility is
re-checked on the server, so the merge can't be pushed somewhere it doesn't
belong.

**A tag manager that actually deletes.** You could always drop a tag from a
single session while editing it, but a typo'd or abandoned tag then lingered in
autocomplete and in the filters with no way to purge it. The Account page now
carries a **Manage tags** panel listing every tag you've used alongside its shot
count; deleting one removes it from every session at once. The structural tags
Apollo writes for you — tournament rounds, match cards, participant and seat
markers, bowstyle and pin overrides — are kept off the list and refused
outright, so a cleanup can never scramble how your rounds and handicaps are
attributed.

**Head-to-head traces that account for your own progress.** When you overlay two
bows, arrows, or tags on the Accuracy & precision traces chart, the comparison
is quietly unfair if you shot one mostly last winter and the other mostly this
spring: you simply got better in between, and whatever you used later rides that
wave. Each subject's per-session trace now carries a dashed same-colour
**skill-adjusted** companion — your overall long-term trend removed and the line
re-based to your current form — so what's left to compare is the kit, not the
calendar. The per-session table and its CSV / Excel export gain matching
skill-adjusted columns. Single-subject (non-overlay) mode is unchanged.

**Performance vs conditions, for all the conditions.** Every session already
records temperature, wind, gust, humidity and pressure, but the report only ever
charted wind (temperature was buried in the table; the rest went unused). It now
draws a panel for each — temperature, gust, humidity and pressure join wind —
every one bucketed into bands with the same accuracy / precision split, so you
can see honestly which conditions actually move your group. Wind direction stays
out: it's a compass bearing, and Apollo stores no shooting direction to turn it
into head / tail / cross-wind. A weather element that no session logged is
simply skipped.

**Small print.** The conditions report switched to the multi-panel layout the
equipment head-to-head report already used, so its CSV / Excel download now
carries a section per weather element. Editing a past session writes its times
through the same validation the live end-session page uses. The formula
reference (§7.7 and the traces entry) documents the new weather bands and the
skill-adjustment math.
