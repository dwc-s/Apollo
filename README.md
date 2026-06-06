# Apollo

Flask web app for logging archery practice and analyzing performance.
Tap a target image to record each shot, group shots into quivers and
sessions, run formal tournament rounds, and review hit rate, group
geometry, and equipment comparisons over time. Supports multiple users,
bows, arrows, and target faces.

A hosted instance lives at <https://apolloshoots.org>.

---

## Quick start

```bash
python install.py
```

`install.py` walks you through:

1. Picking an environment manager (conda if installed, else venv)
2. Picking a flavor — `local` (SQLite) or `server` (MySQL)
3. Installing the Python packages it needs into that env
4. Collecting env vars (`SECRET_KEY`, `RESEND_API_KEY`, and — for
   server — `DATABASE_URL`, `APOLLO_BASE_URL`, and the root account)
5. Writing those env vars to `.env` next to `apollo.py` (chmod 600).
   For the server flavor it also writes `wsgi_snippet.py`, a ready-to-
   paste WSGI configuration file with your real values filled in.

Then to run locally:

```bash
source .env
conda activate apollo            # or: source venv/bin/activate
python apollo.py
```

The app starts on `http://127.0.0.1:5000/`. Click **Create account** to
register the first user — any data left over from a pre-multi-user
install is claimed by the first account automatically.

See [install_help.txt](install_help.txt) for a full walkthrough of every
prompt, env var, and the PythonAnywhere deploy procedure.

---

## Project layout

```
apollo/
├── README.md            ← you are here
├── install.py           ← interactive bootstrapper
├── install_help.txt     ← detailed install / deploy reference
├── apollo.py            ← the Flask app + schema
├── apollo.db            ← local SQLite DB (created on first launch)
├── static/              ← target images, CSS, JS, logos
│   └── targets/         ← user-uploaded target images
├── templates/           ← Jinja templates
└── documentation/
    └── tournament/      ← rule/scoring/target reference for /tournament
```

---

## Two backends

Storage runs through SQLAlchemy Core, so the same code works against
SQLite or MySQL. The backend is picked at startup from the
`APOLLO_BACKEND` env var:

| `APOLLO_BACKEND` | Behavior                                                                 |
|------------------|--------------------------------------------------------------------------|
| unset / `sqlite` | Local file-based SQLite (`apollo.db` next to `apollo.py`). `DATABASE_URL` is **ignored** so a stray export can't accidentally point a dev shell at a remote DB. |
| `mysql`          | Use `DATABASE_URL`; raise loudly if it isn't set.                        |

`install.py` sets `APOLLO_BACKEND=mysql` for you in the server flavor;
the local flavor leaves it unset.

At startup the app prints `📦 Apollo DB: <redacted-url>` so you can
confirm which backend you actually hit.

### `DATABASE_URL` format

```
# SQLite (file-based — generated automatically; rarely set by hand)
sqlite:///apollo.db

# MySQL (server flavor — requires PyMySQL, installed by `install.py`)
mysql+pymysql://user:password@host:port/dbname
```

---

## Environment variables

Apollo reads these from `os.environ` at startup — there is no dotenv
loader. `install.py` writes the `export KEY=value` form to `.env`; you
must `source .env` (or set them inside your WSGI file) before launching
the app.

| Variable               | Required?         | Notes                                                                     |
|------------------------|-------------------|---------------------------------------------------------------------------|
| `SECRET_KEY`           | Prod: **yes**     | Signs Flask sessions + CSRF tokens. Dev generates a random fallback.      |
| `APOLLO_BACKEND`       | Server: `mysql`   | Explicit opt-in for the MySQL path. Unset / `sqlite` ⇒ local SQLite.      |
| `DATABASE_URL`         | `APOLLO_BACKEND=mysql`: yes | SQLAlchemy URL.                                                |
| `APOLLO_BASE_URL`      | Prod: **yes**     | Public origin used in password-reset email links (e.g. `https://apolloshoots.org`). |
| `APOLLO_ROOT_USERNAME` | Server: yes       | Bootstraps / re-affirms the root admin account on every boot.             |
| `APOLLO_ROOT_EMAIL`    | Server bootstrap  | Used only when the root account doesn't exist yet.                        |
| `APOLLO_ROOT_PASSWORD` | Server bootstrap  | Used only when the root account doesn't exist yet. Safe to remove from `.env` after first boot. |
| `RESEND_API_KEY`       | Optional          | Powers password-reset email. If unset, Apollo prints reset links to the server log. |
| `RESEND_FROM`          | Optional          | Sender address. Must be on a Resend-verified domain to mail real users.   |
| `FLASK_ENV`            | Server: `production` | Disables the Werkzeug debugger and makes `SECRET_KEY` + `APOLLO_BASE_URL` mandatory. |
| `FLASK_DEBUG`          | Optional          | `1` (default in dev) enables debug. Ignored when `FLASK_ENV=production`.  |

---

## Schema

All tables are defined as SQLAlchemy Core `Table` objects in `apollo.py`
and created by `metadata.create_all(engine)` at import time.
`migrate_db()` (also at import) adds any new columns to pre-existing
DBs in place.

| Table              | Purpose                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `users`            | One row per account (creds, lockout state, `is_root`, timezone).         |
| `apollo`           | One row per shot (coords, quiver/session metadata, equipment snapshot).  |
| `session_times`    | Session start/end times, optional manual length override.                |
| `targets`          | Available target faces (image, physical size, default flag).             |
| `target_zones`     | User-defined concentric scoring rings per target.                        |
| `bows`             | Bow inventory (model, type, draw weight, AMO length, nock height).       |
| `arrows`           | Arrow inventory (length, spine, weights, shaft, tip).                    |
| `password_resets`  | One-shot, short-lived reset tokens (stored as sha256, never plaintext).  |
| `rate_limit_hits`  | Persistent rate-limit counters (login, forgot-password).                 |
| `app_settings`     | Global key/value config (e.g. server timezone).                          |
| `user_notes`       | Per-user free-form scratchpad (one row per user).                        |

Every table has an explicit `id INTEGER PRIMARY KEY AUTOINCREMENT`.
Queries in the app SELECT it aliased as `rowid` so older templates that
read `rowid` keep working unchanged. All per-user tables carry a
`user_id` column added by `ensure_user_id_columns()` for pre-multi-user
DBs.

---

## Analyze (`/analyze`)

Pick which reports to generate from a checkbox list; each report renders
a chart plus a table of the underlying data, an intro paragraph framing
the question it answers, and offers CSV / Excel downloads. Hover any
metric or test name for an inline tooltip explaining what it measures
and why it's there. Length values render with a server-side **mm** unit
that flips to **inches** when you click `⇄ Imperial` on the side nav.

### The accuracy / precision split

Archery error decomposes into two independent modes that **need
different fixes**:

| Mode | Definition | Headline number | Fix |
|---|---|---|---|
| **Accuracy** | Where the group's *centroid* sits relative to the bull. A bias. | **MPI** = ‖centroid − bull‖ | Sight, anchor, form |
| **Precision** | How tightly shots cluster *around their own centroid*, independent of where that centroid sits. A consistency. | **R95** = 95% containment radius about the centroid | Tuning, execution, equipment |

Every report in `/analyze` reports these two axes separately. A "total
error" metric (mean distance from the bull, Mann-Whitney U on the same)
still appears, but is always labelled as a hybrid and never confused
with either axis.

A single `_archery_stats(xs, ys)` helper drives every panel — it fits a
bivariate normal to the shot cloud and returns MPI, signed bias, Mean
Radius, σ_x, σ_y, ρ, R95 (Rayleigh closed-form when isotropic, elliptical
otherwise via χ²₂), and extreme spread. Samples below n=10 fall back to
an empirical R95 percentile and the table flags them.

### Reports

**Activity**

- **Arrows shot vs time** — bar chart of arrows shot per calendar day
  (zero-fill so gaps are visible). Sessions on the same day are summed.
- **Sessions per day** — same idea but bar = session count.
- **Shot volume calendar** — GitHub-style year grid of shots per
  calendar day with month-boundary ticks and a summary table (span,
  active-day %, busiest day, avg-on-active-days). Streaks and gaps are
  visible at a glance.

**Per-target visualization**

- **Shots per target (date range)** — every shot on each target,
  overlaid on the face with: a centroid X, concentric **MR** (solid)
  and **R95** (dashed) precision rings, a faint covariance ellipse
  exposing stringing, and a pink bias arrow from the bull to the
  centroid. Stats table split into Accuracy (MPI, signed bias) and
  Precision (R95, MR, σ_x/σ_y, extreme spread). Accepts a date range.
- **Shot density heatmap** — hexbin density overlay on each target
  with ≥25 hits. Complementary to the scatter once you have hundreds
  of shots on one face. Quadrant-breakdown table makes directional
  bias jump out without reading the colorbar.
- **Hits by boundaries** — for targets with scoring zones, counts hits
  per ring + a replay of every shot. Bar colors are sampled directly
  from the target image (works for any face you upload — NASP, FITA,
  3D, Vegas, NFAA).
- **Expected score from fit** — for each scoring target, fits a 2D
  Gaussian to your history, Monte-Carlo samples 20 000 draws, and
  projects expected points/arrow and expected end scores at 3 / 6 / 10
  arrows. Empirical sentinel-miss rate is blended in so total-flyers
  count against the projection.

**Trends over time**

- **Accuracy & precision over time** — two-trace line chart:
  - **MPI** (accuracy) line in red.
  - **R95** (precision) line in green.

  Per-bucket table also shows MR, σ_x, σ_y. Auto-buckets to day, week,
  or month based on the span. Distances are normalized by target
  half-width so mixed sizes pool fairly.
- **Within-session drift** — pools shots by *quiver index in session*
  (1st quiver, 2nd, …) across all sessions, then plots MPI and R95
  against quiver index. Reveals warm-up gains and late-session fatigue.
  Twin-axis grey bars show how many sessions contribute to each bucket
  so you know where confidence drops.
- **Cold bore vs warmed up** — pool 1 = first quiver of every session;
  pool 2 = quivers 2+. Side-by-side bars on MPI / R95 / pool size, then
  independent **Hotelling T²** (accuracy diff) and **Brown-Forsythe**
  (precision diff) tests with per-axis verdicts.

**Equipment comparison**

- **Head-to-head comparisons** — see the next section.

### Head-to-head statistical model

For every pair of bows / arrows / session tags with at least 5 shots
each, Apollo decomposes the comparison into **three independent test
families** so you can tell *what* differs, not just *that* something
does:

| Family | Question | Test | Input |
|---|---|---|---|
| **Accuracy** | Do the centroids sit in different places? | **Hotelling's T²** on (x, y) | 2D normalized shot vectors |
| **Precision** | Does one group cluster more tightly about *its own* centroid? | **Brown-Forsythe** (median-centered Levene's) | distance-from-each-group's-own-centroid |
| **Total error** | Does one piece simply land closer to the bull on average? | **Mann-Whitney U** + **Cliff's δ** | distance-from-target-center |

The Precision family's input matters: feeding the F-test
distance-from-center (as earlier versions did) lets a group's bias leak
into the spread test. Distance-from-each-group's-own-centroid is the
honest precision signal.

p-values are adjusted with **Holm-Bonferroni** within each family
separately. Per-pair tables render the three families as titled
sub-sections (Accuracy / Precision / Total error / Pairwise tests), and
the verdict line surfaces all three axes:

```
Accuracy: inconclusive (p = 0.47) · Precision: significant (p = 0.026) · Total error: significant (p = 0.048)
```

That triple lets you attribute a "this bow shoots better overall" win
to better precision rather than better accuracy (or vice versa) — they
need different remedies at the range.

**Caveat:** shots within a session are correlated (wind, light, fatigue
all create within-session covariance). None of these tests model that,
so adjusted p-values understate the true error rate. Treat them as
exploratory — significant pairs are worth a closer look, but small
samples or borderline results shouldn't be over-read.

**Implementation:** scipy is a soft dependency. When installed,
`scipy.stats.mannwhitneyu` / `f.sf` are used directly; otherwise the
helpers fall back to the normal approximation (Mann-Whitney) or a
continued-fraction regularized incomplete beta (F-distribution). χ²₂
quantiles for R95 / CEP use the closed-form `−2·ln(1 − q)`. All paths
agree to better-than-display precision for the sample sizes /analyze
sees.

---

## Notes

- **Multi-user.** The first account to register inherits any data left
  over from a pre-multi-user install. Subsequent accounts start empty.
  Root (created from `APOLLO_ROOT_*`) can browse/delete users and reset
  passwords or email addresses via `/admin`.
- **CSRF.** Every POST form includes `{{ csrf_token() }}`. Rotating
  `SECRET_KEY` invalidates in-flight tokens — expected.
- **Password resets.** Tokens are sha256-hashed at rest, one-shot, and
  expire after a short TTL. Without `RESEND_API_KEY`, the reset URL is
  printed to the server log instead of mailed — fine for solo/offline
  use.
- **Tournament mode.** `/tournament` runs WA / NFAA / USAA / NASP
  rounds with the right end size, target face, and scoring rule. See
  [documentation/tournament/](documentation/tournament/) for the
  internal rule reference. Verify against current official rulebooks
  before relying on a score for competition.
