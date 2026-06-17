v0.77 — One way to log a shot, one way to send a mail

Nothing changes on screen in this release — it's a tidy-up under the floor.
Two jobs in the app had grown a second, near-identical copy of themselves, and
two copies of the same logic are two places a future fix has to remember to
land. This release folds each pair back into one.

- **One shot-insert path.** Recording a tournament shot used its own ~75-line
  copy of the bow/arrow/gear snapshot-and-insert that the live session already
  did through `_insert_shot`. The tournament path now calls `_insert_shot` too,
  so the two stay in lockstep — a new column added to a shot can't drift into
  one path and miss the other. Behaviour is identical: the tournament specifics
  (quiver fixed at the round's arrows-per-end, no session notes, the round/match
  tag) are just passed as arguments.

- **One email helper.** `_send_email_with_attachments` was a clone of
  `_send_email` with an extra field. Attachments are now an optional argument to
  `_send_email`; the duplicate is gone and the tournament-results mailer calls
  the single helper. `base64` moves to a module-level import.

- **Bow-retype maintenance script.** `retype_bows.py` is a one-off,
  dry-run-by-default tool for correcting a bow entered under the wrong bowstyle
  (e.g. recurve → barebow) — something the UI deliberately won't let you edit.
  It reuses the app's own DB layer, so it works against SQLite locally or MySQL
  on the server, scopes every change to one user, and only writes when re-run
  with `--apply` (optionally `--include-shots` to reclassify past shots).

Internally: ~78 net lines removed from `apollo.py`; no behaviour change, no new
dependencies, no migration. The full test suite (29 tests) passes, and both the
plain and with-attachments email paths were exercised end-to-end against the
Resend SDK.
