v0.70 — A handicap you can watch fall

Apollo has always computed an Archery GB 2023 handicap for every completed AGB
target round, but only ever showed it as a footnote on the round-complete
banner and in the session history — a number you saw once and lost. A handicap
is meant to be tracked: it's the single figure that tells you whether months of
practice are actually working. This release turns those scattered per-round
numbers into a trend, in a new /analyze report.

- **New report: "Handicap over time."** Pick it on /analyze to plot the AGB
  handicap of every recognised AGB target round you've completed, against the
  date you shot it. The y-axis is inverted, so a rising line means a falling
  handicap — improvement reads as up. A least-squares trend line (labelled in
  handicap-points per year) and a reference line for your AGB figure sit on top.

- **Three headline figures.**
  - *Latest* — your most recent round's handicap.
  - *Best (recent)* — the lowest single handicap in the last 12 months.
  - *AGB handicap* — the official 2023-scheme figure: the average of your best
    three handicaps, rounded **down** (the scheme rounds averages down). Taken
    from the current season; with fewer than three rounds there it falls back to
    the trailing 12 months, then to all rounds, and labels the result
    provisional rather than passing it off as official. Needs three rounds.

- **An honest caveat.** Apollo has no notion of a record-status shoot, so every
  completed round counts toward the figure. It's a personal tracking number, not
  one you'd submit to a records officer — the report says as much.

- CSV / Excel export comes for free; /analyze's export route reuses the report.

The aggregation rule is a pure, DB-free helper (`_handicap_summary`) with unit
tests in tests/test_handicap_summary.py covering the best-three average, the
round-down, the season fallback, and the three-round minimum. The chart and
per-distance handicap math reuse the existing handicap.py engine — no schema
changes, no new dependencies.
