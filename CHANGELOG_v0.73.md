v0.73 — The range, on paper

Sometimes you can't enter shots on a phone as you go — you shoot a practice
round, or just a few ends at the range, and write the ring values on paper.
Apollo already had paper entry for *real* competitions ("Enter scoresheet from
actual tournament"); this release adds the same for practice, with the
flexibility a range session needs. Along the way, the handicap was brought
into line with how Archery GB actually issues it.

- **Enter practice scorecard.** A fourth button on every tournament round card.
  Pick a round, type each arrow's ring value (`X`, a ring number, or `M`) into
  a grid, and save. You land on the same results page as the competition
  scoresheet, with PDF / CSV / Excel downloads.

- **Arbitrary ends.** Unlike the competition scoresheet, the end count and
  arrows-per-end are not locked to the round spec. The grid defaults to the
  round's ends × arrows, but you can change any end's arrow count, and add or
  remove ends freely — each new end inherits the previous one's count. Live
  running totals, end totals, and X-count update as you type.

- **The round's own target face.** The face is fixed to the round you chose
  (not arbitrary): a practice scorecard under *WA Indoor 25m* scores against the
  WA 60cm 10-zone face, at that round's distance.

- **Practice never touches your handicap.** A practice scorecard — and the live
  on-screen Practice mode — is now excluded from the running Archery GB
  handicap figure. Only rounds you actually competed (match play, or a score
  sheet logged from a real competition) feed it. A practice card never shows a
  handicap or classification at all, regardless of its layout.

- **Handicaps on the official 0–150 scale.** The displayed handicap is now
  clamped to the scale Archery GB actually issues (0 = best, 150 = worst): a
  perfect round reads **0** instead of a negative model value, and a near-zero
  score caps at 150. The underlying scheme math is unchanged.

- **Handicap shown on results, with a plain-English note.** Completed
  competition scoresheets now surface the per-round handicap and any
  classification awards on the results page, with a tooltip clarifying it's a
  per-round figure — not a running or cumulative handicap.

Internally: coordinates for scorecard arrows reuse the existing
`_coords_for_ring_label` (mid-ring, line-cutter-safe), so no new scoring math.
End chunking gained a `chunk_by_stored` mode in `_compute_tournament_progress`
so arbitrary-length ends rebuild from each row's stored arrow count, letting the
whole results / download pipeline be reused unchanged. Practice sessions reuse
the match plumbing via a new `practice_scorecard` tag; `_counts_toward_handicap`
gates the handicap trend; `_session_handicap` clamps to `[0, 150]`. No schema
changes, no new runtime dependencies.
