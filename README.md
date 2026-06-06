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
a chart plus a table of the underlying data and offers CSV / Excel
downloads.

### Reports

- **Arrows shot vs time** — bar chart of arrows shot per calendar day
  (zero-fill between the first and last day so practice gaps are
  visible). Sessions on the same day are summed; the table beneath the
  chart still lists the underlying per-session counts.
- **Sessions per day** — same idea but the bar is sessions instead of
  arrows.
- **Shots per target (date range)** — every shot you've placed on each
  target, overlaid on the target face with centroid and group-spread
  circle. Accepts a date range.
- **Hits by boundaries** — for targets with scoring zones, counts hits
  per ring + a replay of every shot on that target.
- **Accuracy over time** — line chart with three traces per time bucket
  (day / week / month, auto-picked so you get ~12–40 buckets):
  - **MPI** — Mean Point of Impact, i.e. distance from target center to
    the centroid of that bucket's shots. Captures systematic *bias*.
  - **σ from center** — standard deviation of distance-from-center.
    The traditional "shots within …" notion.
  - **Mean normalized distance** — average |shot|. Lower = better.

  Distances are normalized by target half-width so mixed target sizes
  stay comparable.
- **Head-to-head comparisons** — see below.

### Head-to-head statistical model

For every pair of bows / arrows / session tags with at least 5 shots
each, Apollo runs three independent tests on normalized distances:

| Test | Question it answers | Why this test |
|---|---|---|
| **Mann-Whitney U** + **Cliff's δ** | Does one piece tend to land closer to center than the other? | Nonparametric — distance-from-center is right-skewed and bounded ≥ 0, so a rank-based test is more honest than Welch's t. Cliff's δ ∈ [−1, +1] is the matching effect size: P(A > B) − P(A < B). |
| **Brown-Forsythe** (median-centered Levene's) | Does one piece group *tighter* than the other? | Robust to non-normality. Tests equality of spread directly, which is the consistency question separate from accuracy. |
| **Hotelling's T²** on the 2D centroid | Does one piece systematically push shots in a particular direction (left/right/up/down bias)? | Multivariate analogue of the t-test; treats (cx, cy) as a single 2D measurement rather than collapsing to radius. |

All three p-values are adjusted with **Holm-Bonferroni** within each
test's family (the set of pairs in the current section), so a "p < 0.05"
verdict accounts for multiple comparisons.

**Caveat:** shots within a session are correlated (wind, light, fatigue
all create within-session covariance). None of these tests model that,
so adjusted p-values understate the true error rate. Treat them as
exploratory — significant pairs are worth a closer look, but small
samples or borderline results shouldn't be over-read.

**Implementation:** scipy is a soft dependency. When installed,
`scipy.stats.mannwhitneyu` / `f.sf` are used directly; otherwise the
helpers fall back to the normal approximation (Mann-Whitney) or a
continued-fraction regularized incomplete beta (F-distribution). Both
paths agree to better-than-display precision for the sample sizes
/analyze sees.

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
