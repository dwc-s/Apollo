# Apollo

Flask web app for tracking archery practice. Log each shot's coordinates on a
target image, group shots into quivers and sessions, and review hit rate,
session length, and per-quiver breakdowns over time. Supports multiple bows,
arrows, and target faces.

---

## Quick start

```bash
cd development
python install.py
```

`install.py` walks you through:

1. Creating a conda environment (default name `apollo`, Python 3.11)
2. Installing the Python packages it needs into that env
3. Choosing `local` (SQLite) or `server` (MySQL) flavor
4. Collecting required env vars (SECRET_KEY, DATABASE_URL if server)
5. Writing those env vars to `development/.env` (chmod 600)

Then to run:

```bash
source .env
conda activate apollo
python apollo.py
```

The app starts on `http://127.0.0.1:5000`.

---

## Project layout

```
apollo/
├── README.md                       ← you are here
├── development/                    ← working copy; edit here
│   ├── apollo.py                   ← the Flask app + schema
│   ├── install.py                  ← interactive bootstrapper
│   ├── migrate_to_production.sh    ← copy to production/
│   ├── static/                     ← target images, CSS, logos
│   │   └── targets/                ← user-uploaded target images
│   ├── templates/                  ← Jinja templates
│   └── apollo_legacy.db            ← pre-SQLAlchemy SQLite DB (archived)
└── production/                     ← deployable copy (synced from dev)
```

`apollo.py` lives in two places: `development/` is where you make changes,
`production/` is the deployable snapshot. `migrate_to_production.sh` is a
plain `cp` that promotes the dev tree.

---

## Two backends

Storage runs through SQLAlchemy Core, so the same code works against SQLite
or MySQL. The backend is picked at startup from (in priority order):

1. The `DEV_BACKEND` constant at the top of `apollo.py` (for debug/QA)
2. The `DATABASE_URL` environment variable
3. A fallback to a local file-based SQLite DB next to `apollo.py`

### `DEV_BACKEND` toggle

Open `apollo.py` and edit:

```python
DEV_BACKEND = None  # 'sqlite' | 'mysql' | None
```

| Value      | Behavior                                                                 |
|------------|--------------------------------------------------------------------------|
| `None`     | Production behavior: use `DATABASE_URL` if set, else SQLite fallback     |
| `'sqlite'` | Force local SQLite, **ignore** any `DATABASE_URL` in the shell           |
| `'mysql'`  | Force MySQL; raise loudly if `DATABASE_URL` isn't set                    |

At startup the app prints `📦 Apollo DB: <redacted-url>` so you can confirm
which backend you actually hit.

### `DATABASE_URL` format

```
# SQLite (file-based)
sqlite:///apollo.db

# MySQL (web/cloud — requires PyMySQL, installed by the 'server' flavor)
mysql+pymysql://user:password@host:port/dbname
```

---

## Environment variables

| Variable        | Required? | Notes                                                                 |
|-----------------|-----------|-----------------------------------------------------------------------|
| `SECRET_KEY`    | Prod yes  | Signs Flask sessions + CSRF tokens. Dev has a hardcoded fallback.     |
| `DATABASE_URL`  | Server yes| SQLAlchemy URL. Defaults to local SQLite when unset.                  |
| `FLASK_ENV`     | Optional  | Set to `production` to force-disable the Werkzeug debugger.           |
| `FLASK_DEBUG`   | Optional  | `1` = debug mode (default in dev); ignored when `FLASK_ENV=production`. |

`install.py` writes these to `development/.env` as `export KEY=value` lines;
`source .env` before launching the app.

---

## Schema

Five tables, all defined as SQLAlchemy Core `Table` objects in `apollo.py`
and created by `metadata.create_all(engine)` at import time.

| Table           | Purpose                                                          |
|-----------------|------------------------------------------------------------------|
| `apollo`        | One row per shot (coords, quiver/session metadata, target ref)   |
| `session_times` | Session start/end times, optional manual length override         |
| `targets`       | Available target faces (image, physical size, default flag)      |
| `bows`          | Bow inventory (model, type, poundage, AMO length)                |
| `arrows`        | Arrow inventory (length, spine, weights, tip)                    |

Every table has an explicit `id INTEGER PRIMARY KEY AUTOINCREMENT`. Queries
in the app SELECT it aliased as `rowid` so templates that read `rowid` keep
working unchanged.

---

## Promoting to production

```bash
cd development
./migrate_to_production.sh
```

This is a plain `cp` that copies `apollo.py`, `static/`, and `templates/`
into `../production/`. `.env`, `apollo.db`, and `install.py` are
intentionally not copied — production should have its own env config and DB.

---

## Notes

- **`apollo_legacy.db`** is the original pre-SQLAlchemy SQLite database with
  the old typeless schema. Kept around so you can still inspect old session
  data, but unused by the current app — the new schema lives in `apollo.db`
  (created automatically on first launch in local mode).
- **Single-user assumption.** Session IDs are minted with
  `SELECT MAX(session_id)+1`, which has a race window between two
  near-simultaneous `/sesh` GETs. Fine for a personal tool; switch to an
  `AUTO_INCREMENT` session counter before going multi-user.
- **CSRF.** Every POST form must include `{{ csrf_token() }}`. Rotating
  `SECRET_KEY` invalidates in-flight tokens — expected.
