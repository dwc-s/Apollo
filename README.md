# Apollo

Flask web app for tracking archery practice. Log each shot's coordinates on a
target image, group shots into quivers and sessions, and review hit rate,
session length, and per-quiver breakdowns over time. Supports multiple bows,
arrows, and target faces.

A *session* is one practice round. A *quiver* is a fixed batch of arrows
within a session (e.g. 6 arrows → walk to the target → repeat). Shot
coordinates are stored as physical millimeters from target center
(+X right, +Y up); the sentinel value `100000` in both `x_coord` and
`y_coord` marks a missed target.

---

## Quick start

```bash
python install.py
```

`install.py` walks you through:

1. Picking an environment manager (conda or venv)
2. Choosing `local` (SQLite) or `server` (MySQL) flavor
3. Installing the Python packages it needs
4. Collecting required env vars (SECRET_KEY, DATABASE_URL if server, etc.)
5. Writing those env vars to `.env` (chmod 600)

Then to run:

```bash
source .env
conda activate apollo            # or: source venv/bin/activate
python apollo.py
```

The app starts on `http://127.0.0.1:5000`.

See `install_help.txt` for the long-form walkthrough — every prompt,
every env var, and a step-by-step PythonAnywhere deployment guide.

---

## Project layout

```
apollo/
├── README.md            ← you are here
├── install_help.txt     ← installer reference / deployment guide
├── install.py           ← interactive bootstrapper
├── apollo.py            ← the Flask app + schema
├── static/              ← target images, CSS, JS, logos
└── templates/           ← Jinja templates
```

---

## Two backends

Storage runs through SQLAlchemy Core, so the same code works against SQLite
or MySQL. The backend is picked at startup from:

1. `APOLLO_BACKEND=mysql` env var → use `DATABASE_URL`
2. Otherwise → local file-based SQLite (`apollo.db` next to `apollo.py`)

### `DATABASE_URL` format

```
# SQLite (file-based) — the default; no env var needed
sqlite:///apollo.db

# MySQL — requires PyMySQL, installed by the 'server' flavor
mysql+pymysql://user:password@host:port/dbname
```

---

## Environment variables

| Variable             | Required?    | Notes                                                                     |
|----------------------|--------------|---------------------------------------------------------------------------|
| `SECRET_KEY`         | Prod yes     | Signs Flask sessions + CSRF tokens. `install.py` generates a strong one.  |
| `APOLLO_BACKEND`     | Server yes   | Set to `mysql` to honor `DATABASE_URL`. Unset = local SQLite.             |
| `DATABASE_URL`       | Server yes   | SQLAlchemy URL. Only consulted when `APOLLO_BACKEND=mysql`.               |
| `APOLLO_BASE_URL`    | Server, opt  | Public origin baked into password-reset email links.                      |
| `RESEND_API_KEY`     | Optional     | Resend API key for the forgot-password flow. Unset = print URLs to log.   |
| `RESEND_FROM`        | Optional     | Sender address for reset emails. Default: `onboarding@resend.dev`.        |
| `APOLLO_ROOT_*`      | Server, boot | `USERNAME` / `EMAIL` / `PASSWORD` for the bootstrap admin account.        |
| `FLASK_ENV`          | Optional     | Set to `production` to force-disable the debugger and require SECRET_KEY. |
| `FLASK_DEBUG`        | Optional     | `1` = debug mode (default); ignored when `FLASK_ENV=production`.          |

`install.py` writes these to `.env` as `export KEY=value` lines;
`source .env` before launching the app.

---

## Schema

Tables are defined as SQLAlchemy Core `Table` objects in `apollo.py` and
created by `metadata.create_all(engine)` at import time, so the same code
bootstraps both SQLite and MySQL.

| Table           | Purpose                                                          |
|-----------------|------------------------------------------------------------------|
| `users`         | Login accounts; root/admin flag, password hash, email            |
| `apollo`        | One row per shot (coords, quiver/session metadata, target ref)   |
| `session_times` | Session start/end times, optional manual length override         |
| `targets`       | Available target faces (image, physical size, default flag)      |
| `bows`          | Bow inventory (model, type, draw weight, AMO length)             |
| `arrows`        | Arrow inventory (length, spine, weights, tip)                    |

Every shot row carries the owning `user_id`; all queries scope to the
logged-in user. CSRF is enforced on every POST.

---

## Notes

- **Multi-user.** Each account sees only its own data. On a fresh install
  the very first account claims any pre-existing rows (smooths the upgrade
  from a single-user install).
- **CSRF.** Every POST form must include `{{ csrf_token() }}`. Rotating
  `SECRET_KEY` invalidates in-flight tokens — expected.
- **Email.** The forgot-password flow uses [Resend](https://resend.com).
  Without an API key, reset links are printed to the server's terminal
  instead of mailed — fine for local testing.
