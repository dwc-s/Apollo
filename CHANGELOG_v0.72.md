v0.72 — The manual, in the app

Apollo's documentation has always lived in Markdown files in the repo — useful
if you were reading the source, invisible if you were just using the app. This
release brings the docs into Apollo itself: a styled, browsable documentation
site served from the app, reachable from the side nav and the splash page, and
generated straight from the same Markdown so it can't drift.

- **A documentation site at `/docs/`.** Every doc — the project overview,
  the formula/math reference, the install & deploy guide, and the full
  tournament rules / scoring / target-face reference — is rendered as an
  app-styled HTML page (Apollo fonts, palette, the same card-and-side-nav feel)
  with a grouped index. Served read-only and **public**, since it's the
  open-source project's own docs.

- **Linked where you'd look for it.** A **Documentation** link sits under
  *Sign out* in the side nav on every page, and the splash page now reads
  "free and open source (documentation)" with the word linking straight to it.

- **Generated, not hand-maintained.** `documentation/build_docs.py` converts the
  Markdown sources to the HTML set (rewriting cross-links, styling tables, code,
  and blockquotes to match the app). Re-run it after editing any doc.

- **Docs reconciled with the code.** While wiring this up, the prose was brought
  back in line with what Apollo actually does today: the Tools page is six
  calculators, not seven (the slope compensator left in v0.69); the handicap
  engine, classifications, performance prediction, the distance-trend fit, and
  the v0.71 bowstyle-gear settings are now documented; the schema table lists the
  new columns; and the tournament docs describe live 2–4 archer match play
  instead of claiming there's no multi-archer mode.

- **One docs folder.** The stray top-level `docs/` (which held only
  `FORMULAS.md`) was folded into `documentation/`, and every reference updated.

Internally: a new `/docs/` route (`send_from_directory`, `.html`-only,
traversal-safe) registered with a trailing slash so the index page's relative
links resolve correctly. No schema changes, no new runtime dependencies — the
HTML is pre-built into `documentation/html/` and shipped as static files.
