# Apollo

Flask web app for logging archery practice and analyzing performance.
Tap a target image to record each shot, group shots into quivers and
sessions, run formal tournament rounds, and review hit rate, group
geometry, and equipment comparisons over time. Supports multiple users,
bows, arrows, and target faces.

You can also join and use it at <https://www.apolloshoots.org>.

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
   server — `DATABASE_URL`, `APOLLO_BASE_URL`, and the root account).
   If you opt into practice reminders it **generates a VAPID keypair
   for you** (run inside the target env, where `pywebpush` was just
   installed) and mints a `CRON_SECRET` — no keys to paste by hand.
5. Writing those env vars to `.env` next to `apollo.py` (chmod 600).
   If you say you're deploying under a WSGI server (PythonAnywhere,
   gunicorn, mod_wsgi) it also writes `wsgi_snippet.py`, a ready-to-
   paste WSGI configuration file with your real values filled in —
   offered for either flavor, since the worker reads `os.environ`
   rather than `.env`.

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
├── handicap.py          ← Archery GB 2023 handicap engine (pure, no Flask/DB)
├── handicap_data.py     ← AGB class / award constant tables
├── classifications.py   ← AGB / WA / USAA classification resolvers
├── static/              ← target images, CSS, JS, logos
│   └── targets/         ← user-uploaded target images
├── templates/           ← Jinja templates
└── documentation/
    ├── FORMULAS.md      ← every scoring / stats / predictive formula + its source fn
    ├── build_docs.py    ← regenerates the styled HTML build from the Markdown
    ├── tournament/      ← rule/scoring/target reference for /tournament
    └── html/            ← styled HTML build of all docs (linked from the side nav)
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
| `VAPID_PUBLIC_KEY`     | Optional          | Web-Push public key (base64url) — `install.py` generates the pair when you enable reminders. Both VAPID keys must be set for practice-reminder push to be offered; unset ⇒ the feature hides itself. |
| `VAPID_PRIVATE_KEY`    | Optional          | Web-Push private key (base64url). Pair with `VAPID_PUBLIC_KEY`.            |
| `VAPID_CONTACT`        | Optional          | `mailto:` the push services can reach you at (VAPID `sub` claim). Defaults to a placeholder. |
| `CRON_SECRET`          | Optional          | Guards `/cron/reminders`. Unset ⇒ the endpoint returns 403 to everyone (fail-closed). Hit it daily: `GET /cron/reminders?key=<CRON_SECRET>`. |
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
| `users`            | One row per account (creds, lockout state, `is_root`, timezone, archer profile: `gender`, `age_group`, `default_bowstyle`, plus reminder prefs: `remind_enabled`, `remind_after_days`, `last_reminder_at`, and an optional saved range `range_lat`/`range_lon`). |
| `apollo`           | One row per shot (coords, quiver/session metadata, equipment snapshot, and a `bow_style_settings` JSON snapshot of the gear in force when the arrow was loosed). |
| `session_times`    | Session start/end times, optional manual length override, and captured weather (`wx_*`: temp, wind, gust, direction, humidity, pressure). |
| `targets`          | Available target faces (image, physical size, default flag).             |
| `target_zones`     | User-defined concentric scoring rings per target.                        |
| `bows`             | Bow inventory (model, type, draw weight, AMO length, nock height), a `style_settings` JSON column for bowstyle-specific static gear, and string-lifecycle fields (`string_installed_on`, `string_shot_baseline`, `string_service_shots`, `setup_note`). |
| `arrows`           | Arrow inventory (length, spine, weights, shaft, tip) plus set-lifecycle fields (`set_size`, `in_service_on`, `retired`). |
| `goals`            | Per-user performance goals (handicap / classification / round-score / accuracy / precision / volume) with an optional deadline; the projection grades on-track / behind / achieved. |
| `user_achievements`| First-earned ledger of AGB classes / WA Star / USAA pins (unique per user + scheme + code). |
| `push_subscriptions` | Web-Push subscriptions for practice reminders (endpoint + keys, unique on the endpoint's sha256). |
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
the question it answers, and offers CSV / Excel downloads. The picker
POSTs once and returns immediately with a spinner card per report; the
browser then fetches each from its own `/analyze/report/<key>` request and
swaps it in as it lands, so the page is interactive at once and reports
render in parallel on a multi-worker host rather than blocking on the
slowest one. Long row-per-shot/session tables collapse to the first ten
rows behind a "Show all N rows" toggle (grouped stat tables stay open).
Hover any metric or test name for an inline tooltip explaining what it
measures and why it's there. Length values render with a server-side **mm**
unit that flips to **inches** when you click `⇄ Imperial` on the side nav.

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
- **Expected score from fit** — for each scoring face, fits a 2D
  Gaussian to your history, Monte-Carlo samples 20 000 draws, and
  projects expected points/arrow and expected end scores at 3 / 6 / 10
  arrows. Empirical sentinel-miss rate is blended in so total-flyers
  count against the projection. A face shot at several ranges is fit
  **per distance** (one panel each, `{face} @ {n} m`) — how tightly you
  group grows with range, so pooling 18 m and 70 m would describe
  neither. The Monte-Carlo is fixed-seed, so repeat renders are identical.
  Draws both the raw geometric projection and a **Fuzzy-Factor-calibrated**
  trace (your real-vs-model scoring ratio, as `/predict` uses) once there's
  enough scored history to trust it.
- **Expected points/arrow vs distance** — lays every face's per-distance
  projection on one axis (one line per face, a marker at each range) so
  the score's drop-off with distance reads at a glance: a steep line
  means distance costs you disproportionately, a flat one means your form
  holds. Same per-distance fit as the report above, and the same raw +
  **Fuzzy-Factor-calibrated** pair of traces. Needs shots logged with a
  distance.

**Trends over time**

- **Accuracy & precision over time** — two-trace line chart:
  - **MPI** (accuracy) line in red.
  - **R95** (precision) line in green.

  Per-bucket table also shows MR, σ_x, σ_y. Auto-buckets to day, week,
  or month based on the span. Distances are normalized by target
  half-width so mixed sizes pool fairly.
- **Accuracy & precision traces** — up to four lines on one date axis:
  MPI and R95 each at two granularities (per session and an all-time
  running value), individually toggleable. Each
  trace labels itself at its right edge and carries a faint same-colour
  linear trend line so its direction reads at a glance. Optionally split
  into a **head-to-head**: pick specific bows / arrows / tags and each
  becomes its own coloured set of traces on the shared timeline.
- **Precision consistency (trend)** — your R95 over time, **one point per
  day of shooting** (all that day's shots pooled), smoothed by a trailing
  **5-day moving average** and wrapped in a shaded **±1σ band**.
  Unlike the *cumulative* all-time R95 in the traces report (which stops
  reacting once your history is long), the moving average cancels
  day-to-day noise while staying responsive to recent change, so
  the direction your group tightness is heading reads at a glance. The band
  is the standard deviation of R95 across each trailing window: a
  *narrowing* band means your precision itself is getting more consistent,
  even if its level hasn't moved. Faint dots show the raw per-day R95
  behind the smoothing; normalized by target half-width, misses excluded.
  Each **face × distance** combination draws its own trace — pooling
  different distances or faces would mix genuinely different precision
  (R95 is size- but not distance-normalized) — so with several combinations
  you get a colour-coded multi-line overlay with a per-combo summary table;
  with a single combination it stays the classic one-line-plus-band view.
  A **face / distance filter** (empty = all) narrows which combinations show.
- **Biggest vs smallest spread per quiver** — per completed quiver, the
  widest and tightest pairwise arrow distance (normalized by face width),
  on a shared chronological axis. The band between them is your
  within-quiver consistency; a trend line runs through each. Narrow by
  session type, equipment, date, or tag.
- **Within-session drift** — do you warm up or fatigue within a session?
  Each session is its own control: quiver 1 is the baseline and every
  later quiver is measured as a *delta* from that session's own start
  (mean miss for accuracy, mean radius for precision), then those deltas
  are averaged across every session reaching each quiver position. This
  paired baseline cancels between-session differences — including the
  pooled-centroid inflation that made an earlier pool-by-index version
  appear to improve late in a session purely as fewer sessions reached
  the higher quiver numbers. A position needs ≥2 sessions to plot; twin-
  axis grey bars show how many contribute to each.
- **Cold bore vs warmed up** — pool 1 = first quiver of every session;
  pool 2 = quivers 2+. Side-by-side bars on MPI / R95 / pool size, then
  independent **Hotelling T²** (accuracy diff) and **Brown-Forsythe**
  (precision diff) tests with per-axis verdicts.
- **Handicap over time** — plots the Archery GB 2023 handicap of every
  recognised AGB target round you've completed against the date you shot
  it, with the y-axis inverted so a *falling* handicap (improvement)
  reads as a rising line. A least-squares trend line (handicap-points per
  year) and a reference line for your AGB figure overlay it. Three
  headline figures: *Latest*, *Best (recent)* (lowest single handicap in
  the last 12 months), and the official *AGB handicap* (average of your
  best three, rounded **down**; season → trailing-12-months → all-rounds
  fallback, labelled provisional below three rounds). Every completed
  round counts — Apollo has no record-status notion — so it's a personal
  tracking number, not one to submit to a records officer.

**Interactive & 3D** *(client-rendered — drag to rotate, press play, or scrub)*

These eight charts are drawn in your browser from raw coordinate data the
server ships (rather than a static image), via a self-hosted Plotly bundle
(3D) or SVG (animation) — so nothing leaves your machine and the app stays
offline-capable. See `documentation/FORMULAS.md` §5.1–5.2 for the math.

- **Shot-density mountain** — the hexbin heatmap lifted into a rotatable
  KDE surface, one peak per target: height is how densely arrows cluster
  there, so the summit is your true point of impact and a broad or twin-
  peaked mountain exposes a loose or stringing group. Needs ≥25 on-face hits.
- **Dispersion cone vs distance** — your 95% group footprint drawn as a
  ring at each distance and stacked into a cone; because dispersion is
  angular the ring grows with range, so the cone widens. This is the
  geometry the performance forecast integrates over. A fainter reference
  cone shows an archer at your current handicap.
- **History core-sample** — every hit at (left/right, up/down, time), so
  each session is a horizontal disc and reading up the column shows your
  whole history drift and tighten. Colour runs teal (early) → purple (recent).
- **Score landscape** — expected points/arrow across distance *and*
  handicap for your most-shot face, rendered as terrain, with a gold marker
  for where you stand now.
- **Group evolution** *(animated)* — steps through your sessions: the group
  appears, its centre drifts, the 95% ring breathes, and a trail traces
  where your point of impact has wandered. Normalized, so mixed targets
  share one face.
- **Within-session playback** *(animated)* — replays your latest session
  arrow by arrow: shots land one at a time, the running score climbs, and
  the group tightens then loosens per end.
- **Predict arrow-drop** *(on `/predict`)* — the Monte-Carlo's simulated
  arrows rain onto the endpoint face as the run plays, so the score
  histogram has a picture of the group it describes.
- **Animated handicap tile** *(on the home dashboard)* — the handicap line
  sweeps itself on (y-inverted, so improvement rises) past dashed AGB
  class-threshold lines, with a gold ping the first time it crosses into
  each class you've earned.

**Equipment comparison**

- **Head-to-head comparisons** — see the next section.

### Head-to-head statistical model

For every pair of bows / arrows / session tags / gear settings (release
aid, aiming method, tab vs glove, sight type, … drawn from the per-bow
bowstyle settings) with at least 5 shots
each — and that have *never been used in the same session* (a pair that
co-occurs in even one session is dropped, since the head-to-head only
tells you something meaningful when the two sides are mutually
exclusive) — Apollo decomposes the comparison into **three independent
test families** so you can tell *what* differs, not just *that*
something does:

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
sees. Every scoring, statistical, and predictive formula is catalogued
with its source function in [documentation/FORMULAS.md](documentation/FORMULAS.md).

---

## Tools (`/tools`)

Ten client-side archery calculators on one page, each in its own
collapsible card (collapsed by default). All math runs in the browser —
no DB hits, no server round-trips per keystroke.

| Tool | What it does |
|---|---|
| **Wind drift** | Drag-based lateral drift on a cylindrical shaft (`F = ½ρv²·C_d·(L·d)`, `drift = ½(F/m)·t²`). Inputs include arrow mass, shaft OD, length, mean wind, and **peak gust** — the wind² scaling in the drag formula means a 1.5× gust produces 2.25× the drift, surfaced explicitly. Shaft OD displays in inches or mm following the global `⇄ Imperial/Metric` toggle. |
| **Sight marks** | Piecewise-linear interpolation across any number of known distance/mark pairs. Extrapolates beyond the known range using the nearest segment's slope and flags it as extrapolated. |
| **Arrow spine selector** | Easton-style adjusted bow weight (±5 lbs/in arrow length, ±1.5 lbs per 25 gr point weight, bow-type correction) → recommended spine band. |
| **FOC** | Standard ATA `((balance − L/2)/L)·100` with low / target / hunting / EFOC band chips. |
| **Arrow speed (fps)** | Two methods: **bow specs** (energy-storage model `v = √(2·η·k·F_peak·stroke / m)`, works for any bow type from peak weight, draw length, brace height, arrow mass) and **IBO/ATA rating** (compound-only delta-from-rating). |
| **Kinetic energy & momentum** | `KE = mv²/450,240` (ft·lb), `momentum = mv/225,218` (slug·ft/s — 7000 gr/lb × 32.174 ft/s²). |
| **Bow-hand error → deviation** | How a small error at the bow is amplified downrange: `miss = distance × error / lever-arm`. Reports the amplification factor ("1 mm at the bow → N mm at the target") and the equivalent angular error. Generalizes to any launch-point error (nock, release, sight). |
| **MOA / mrad + sight clicks** | Two-way angle ↔ linear-size conversion at any distance (`1 mrad @ D(m) = D mm`; `1 MOA ≈ 0.291·D mm`), plus a per-click sight-movement helper. |
| **Group → dispersion projection** | Turns a group size at one distance into an angular spread (MOA/mrad) and projects the expected group at another distance by pure angular scaling — a geometric lower bound (real groups grow faster with drop/wind). |

The energy-storage FPS model uses bow-type-tuned constants for the
force-draw-curve area fraction `k` and mechanical efficiency `η`:
recurve `k=0.45 / η=0.72`, compound `k=0.65 / η=0.85`, longbow
`k=0.40 / η=0.70`. Estimates land within published chronograph ranges
across all three bow types.

---

## Predict (`/predict`)

A performance-prediction wizard. The server fits a 2D angular-dispersion
Gaussian (in milliradians) to a filtered slice of your shot history —
optionally narrowed by bow, arrow, tag, or date range — then hands the
parameters plus a chosen endpoint (a tournament round, a face, or a
custom target/distance) to a client-side Monte-Carlo simulator
(`static/apollo-predict.js`) that grows a score histogram live in the
browser.

Because the model is angular, it extrapolates to **any** distance: a mrad
offset scales linearly with range. When the slice spans at least two
distances with enough hits at each, Apollo also fits a **distance trend** —
how bias and dispersion grow with range — and **shrinks** that growth
(James-Stein style) toward the AGB handicap distance coefficient rather
than trusting a flat fit. Gravity drop and wind aren't modelled; the
results surface σ in mrad so you can sanity-check.

An optional **Fuzzy Factor** calibrates the forecast to reality. The pure-trig
model knows your group geometry but not the confounders that cost real points —
nerves, wind, fatigue, fliers. So Apollo pools all your scored history, compares
what you actually scored against what the model predicts (a server-side
Monte-Carlo of the same fit), and distils it to one scale-free coefficient:
"you shoot about *X*% of the pure-trig projection." Shrunk toward 1.0 when you
have few scores and clamped, it multiplies into the forecast at any face or
distance — and the calibrated distribution is drawn as a second histogram over
the raw one so you can see the correction.

---

## Handicaps & classifications

Apollo computes an **Archery GB 2023 handicap** for every completed AGB
target round and resolves the **classification** earned. The math lives
in three pure, Flask/DB-free modules so it stays unit-testable and
single-sourced:

| Module | Role |
|---|---|
| `handicap.py` | The AGB 2023 handicap engine. Derives an expected arrow/round score from a face's ring geometry + distance (`sigma_t(H,d) = ANG_0·(1+STEP/100)^(H+DATUM)·e^(KD·d)`) and inverts it to the integer handicap for a score. Constants match the MIT-licensed `archeryutils` reference, so numbers agree with published AGB tables and archerycalculator.co.uk. |
| `handicap_data.py` | Constant tables: AGB class definitions, age/gender steps, WA Star Award and USAA pin milestones, which rounds are AGB-classified / indoor / 1440. |
| `classifications.py` | Resolvers for **Archery GB** class (handicap-threshold per category), **World Archery** Star Awards (1440 point milestones), and **USA Archery** Performance Award pins. Returns every award earned for a round + score + category. |

The handicap deliberately uses the **scheme-standard arrow** (5.5 mm
outdoor, 9.3 mm indoor) — not your real shaft — so the figure is
comparable to published tables and between archers; the raw score it's
looked up from is still scored with your actual arrow. The archer
*category* (bowstyle / gender / age group) comes from the **Archer
profile** block on `/account` and is optional — the handicap is computed
without it; it only affects which classification you're awarded. NFAA
classification is deferred (it's a relative multi-score scheme, not a
single-round lookup).

---

## Goals, records, dashboard & reminders

- **Goals (`/goals`).** Set a target and see whether you're on track. Six
  kinds: **handicap** and **classification** (both project your Archery GB
  handicap trend to the deadline and grade *on-track / behind / achieved*),
  **round-score** (a personal-best target on a specific round), **accuracy**
  (MPI) and **precision** (R95) — projected the same way from your per-session
  group stats as a percentage of target half-width — and **volume** (arrows per
  week/month, paced against your shot calendar). The projection reuses the same
  least-squares fit the *Handicap over time* report draws (`_project_handicap`).
- **Records (`/records`).** Personal bests per round, the AGB classification
  ladder (current class + the handicap gap to the next), every WA Star / USAA
  pin / AGB class you've earned (first-earned dates cached in
  `user_achievements`), and **practice bests** — your most accurate and tightest
  completed quiver (MPI / R95 as a % of half-width), longest shooting streak,
  and the month your accuracy improved most — plus practice milestones. Real
  competitions are logged through the Tournament score-sheet flow (which tags
  the session), so they show up in the PBs, handicap, and classification here
  automatically.
- **Home dashboard.** Signed-in, the splash becomes a dashboard: lifetime
  arrows/time, current streak + days since last shot, handicap, classification,
  active goals with their verdicts, and string-service alerts.
- **Weather per session + conditions report.** On the session page, *Capture
  weather* pulls temp/wind/humidity from Open-Meteo (client-side, opt-in) and
  stores it on the session; you can also enter it by hand when editing a
  session. The `/analyze` **Performance vs conditions** report then buckets your
  MPI (accuracy) and R95 (precision) by wind and temperature band — so you can
  see whether wind actually widens your group.
- **Equipment lifecycle.** Edit-bow / edit-arrow pages count shots on each bow,
  shots on the current string (from an install date + baseline), and shots on
  an arrow set, with a *service due* badge when a string passes its
  replace-after threshold.
- **Shareable session card.** The end-of-session screen offers a *Share card*
  button that draws a branded PNG summary on a `<canvas>` and shares it via the
  Web Share API (or downloads it) — entirely client-side.
- **Practice reminders (PWA push).** Opt in on `/account` to a browser
  notification when you've gone quiet. Subscriptions are stored per device;
  `/cron/reminders` (guarded by `CRON_SECRET`, hit daily by an external
  scheduler such as a PythonAnywhere task) pushes anyone past their idle
  threshold, once per lapse. Needs `VAPID_*` keys set — `install.py` generates
  them (and the `CRON_SECRET`) when you enable reminders; without them the
  feature hides itself and the endpoint stays fail-closed.

---

## Notes

- **Multi-user.** The first account to register inherits any data left
  over from a pre-multi-user install. Subsequent accounts start empty.
  Root (created from `APOLLO_ROOT_*`) can browse/delete users and reset
  passwords or email addresses via `/admin`.
- **Bowstyle gear settings.** Apollo offers six bowstyles (recurve,
  compound, barebow, longbow, traditional, flatbow). Selecting a bow type
  reveals exactly that style's gear fields. Gear splits into two tiers:
  *static* gear that rarely changes (compound release aid / let-off /
  peep / scope, recurve clicker / stabilizer / tab, barebow aiming method
  / riser weights) is set on Add/Edit bow; *dynamic* tuning you tweak
  between outings (string crawl, brace height, plunger tension) is chosen
  per session and persists for the rest of it. Each shot snapshots the
  gear in force as JSON, so later edits never rewrite a past shot's
  attribution. The whole feature is driven by one schema dict,
  `BOWSTYLE_SETTINGS`, that templates render from, POST handlers validate
  against, and `/analyze` buckets head-to-head comparisons by.
- **CSRF.** Every POST form includes `{{ csrf_token() }}`. Rotating
  `SECRET_KEY` invalidates in-flight tokens — expected.
- **Password resets.** Tokens are sha256-hashed at rest, one-shot, and
  expire after a short TTL. Without `RESEND_API_KEY`, the reset URL is
  printed to the server log instead of mailed — fine for solo/offline
  use.
- **Tournament mode.** `/tournament` runs World Archery / NFAA / USA
  Archery rounds with the right end size, target face, and scoring rule,
  and supports live match play (2–4 archers taking turns on one device).
  See [documentation/tournament/](documentation/tournament/) for the
  internal rule reference. Verify against current official rulebooks
  before relying on a score for competition. (NASP no longer has its own
  round in the selector; the NASP 40 cm face ships as the default seeded
  target for new accounts.)
- **End-session redirect.** The session-stats screen on `/end_session`
  auto-redirects to the splash 7 seconds after rendering so a user
  ending a session and walking away lands on the public page rather
  than a stale stats card.
