v0.92 — The reports arrive one at a time, the long lists fold away, and the weather tells the truth on the first ask

A performance-and-polish pass over Analyze, plus a quiet correctness fix to the
weather capture. No migrations, no rescoring — the report engines are untouched;
what changed is *when* and *how* their output reaches the page.

**Analyze renders one report at a time.** Picking several reports used to POST
once and build every chart server-side in a single blocking pass — matplotlib
rendering each selected report in sequence — so the page sat blank until the
slowest one finished. Now the POST returns immediately with a spinner card per
report, and the browser fetches each from its own `/analyze/report/<key>`
request, swapping it in as it lands. On a multi-worker host the reports render in
parallel; on a single worker the first card still appears without waiting for the
whole batch, and the page is interactive the moment it loads. The per-report
logic moved into `_run_report` — the single place a report runs, shared by the
new endpoint — and the card markup into a `_report_card.html` partial so the page
and each streamed fragment render identically. matplotlib is imported lazily as
before (only the first report render pays it, isolated to that one request) and
its rendering is guarded by a lock so concurrent report requests can't corrupt
pyplot's process-global state.

**Long tables fold.** Reports that list a row per session, shot or arrow now
collapse to the first ten rows behind a "Show all N rows" toggle, so a long
result stays scannable. Grouped statistics tables (the ones with section-header
rows, like Performance vs conditions and the head-to-head pairs) are left open on
purpose — folding those could hide a whole sub-section's numbers.

**Weather reads true on the first capture.** The session weather button — and the
bow-hand-elevation tool it shares its pattern with — asked the browser for a GPS
fix up to ten minutes old and let the Open-Meteo reading come from the HTTP
cache. So the first capture of a session could quietly report the conditions
where you were on the drive over, and only a re-capture would correct it. It now
forces a fresh fix (`maximumAge: 0`) and a no-store fetch, so the first reading
is the current one.

How it was checked: `pytest` stays green at 48. An end-to-end pass through the
real Flask stack seeded a user with fifteen dated sessions and asserted the POST
renders spinner placeholders and collapses the picker, that
`/analyze/report/<key>` returns a real card with its chart SVG, a long table and
working CSV/Excel links, that an empty report degrades to a graceful card, and
that an unknown key 404s. Driven live in the browser: the reports streamed in as
separate requests with the shell interactive in ~7 ms, the collapse toggle
cycled ten↔fifteen rows with the right labels, and the console stayed clean.
