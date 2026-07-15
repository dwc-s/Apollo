v1.6.1 — A bug hunt hardens the edges: session playback drops corrupt coordinates instead of drawing phantom centre arrows, offline sync skips blank session ids rather than wedging the retry loop with 500s, a crashed report now closes its half-built matplotlib figure and renders a friendly error card, and the tournament score JSON + animated HUD are XSS-proofed

A read-through of the codebase looking for bugs, logic errors, and security
issues. The app came out well — most leads ended at a guard that was already
there — but the pass surfaced three real bugs and two fragile patterns worth
closing. No feature changes.

**Within-session playback no longer draws a phantom bullseye arrow.** Shot
coordinates aren't validated as numeric when they're written (deliberate — the
offline queue needs to accept whatever the device recorded), so a blank or
corrupt coordinate could reach the playback animation as a raw string. The
browser coerced it to `0`, painting a fake arrow dead-centre on the bull. The
report now parses coordinates before shipping them and drops any that don't
parse, so a bad row is omitted rather than mis-drawn.

**The offline sync retry loop can't wedge on a blank session id anymore.** A
queued shot with an empty `session_id` slipped past the batch-validation filter
(which skips blanks) and then hit `int('')` in the insert loop, throwing a 500.
Because the PWA re-sends the whole queue on failure, that one malformed entry
would strand the batch and retry it forever. The insert loop now skips a blank
`session_id` the same way the validator does, so the rest of the queue syncs.

**A report that crashes fails gracefully instead of leaking a figure.** If an
Analyze report function threw an unexpected error, the exception escaped and left
its half-built Matplotlib figure alive in pyplot's process-global manager — the
Agg backend never garbage-collects open figures, so each crash grew the worker's
memory a little, permanently. A crashed report now closes any open figures (under
the render lock, so nothing else is mid-render) and re-raises, and both the
`/analyze` and dashboard endpoints catch it to render a friendly "unexpected
error" card with the traceback logged, rather than 500-ing the fragment.

**The tournament score data and animated HUD are XSS-proofed.** Two tournament
score tables were injected into the page with `json.dumps(...)|safe`, which
doesn't escape a `</script>` sequence, and the animated-chart HUD wrote its
rows via `innerHTML`. Neither was exploitable today — the data is all
internally generated — but both were one careless future field away from
trouble. The JSON now uses Jinja's `|tojson` (which escapes `</script>`), and
the HUD is built with DOM nodes and `textContent`, so its values can never be
parsed as markup.
