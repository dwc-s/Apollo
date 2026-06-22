"""Interactive bootstrap for Apollo.

Creates a Python env (conda or venv), installs the packages Apollo needs,
asks whether you're setting up the local (SQLite) or server (MySQL)
flavor, collects the env vars that flavor needs, and writes them to a
.env file next to this script. Run once after cloning, then follow the
printed instructions to launch the app.

Picks conda if available, otherwise falls back to `python -m venv`. On
hosts without conda (e.g. PythonAnywhere) the venv path is the right
one — there's nothing to install first.
"""
import getpass
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from secrets import token_urlsafe

# Mirrors apollo.py — kept in sync so we reject the same shapes the app
# would later reject at login time.
_USERNAME_RE = re.compile(r'^[A-Za-z0-9_.\-]{3,32}$')
_EMAIL_RE    = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
_MIN_PASSWORD_LEN = 8

HERE = Path(__file__).parent.resolve()
ENV_FILE = HERE / ".env"

# Pure-Python packages — installed via pip inside the env. PyMySQL is
# only pulled in for the server flavor since the local flavor talks to
# SQLite via SQLAlchemy's bundled driver.
BASE_PACKAGES = ["Flask", "Flask-WTF", "Pillow", "SQLAlchemy", "openpyxl",
                 "resend", "matplotlib"]
SERVER_PACKAGES = ["PyMySQL"]

# Resend's shared sandbox sender. Only delivers to verified test
# recipients in the Resend dashboard — fine for first-run testing, but
# anyone going live should swap it for an address on a verified domain.
DEFAULT_RESEND_FROM = "onboarding@resend.dev"


def prompt(question, default=None, required=True):
    suffix = f" [{default}]" if default is not None else ""
    while True:
        ans = input(f"{question}{suffix}: ").strip()
        if not ans and default is not None:
            return default
        if ans or not required:
            return ans
        print("  (required — please enter a value)")


def yes_no(question, default=True):
    hint = "Y/n" if default else "y/N"
    ans = input(f"{question} [{hint}]: ").strip().lower()
    if not ans:
        return default
    return ans.startswith("y")


def choose(question, options, default=None):
    hint = "/".join(o.upper() if o == default else o for o in options)
    while True:
        ans = input(f"{question} [{hint}]: ").strip().lower()
        if not ans and default is not None:
            return default
        if ans in options:
            return ans
        print(f"  (pick one of: {', '.join(options)})")


def prompt_password(question):
    """Read a password twice (no echo) and confirm they match.

    Uses getpass so terminal scrollback doesn't end up with the
    plaintext. Loops until the two entries agree and meet the length
    floor that apollo.py enforces at login.
    """
    while True:
        pw = getpass.getpass(f"{question}: ")
        if len(pw) < _MIN_PASSWORD_LEN:
            print(f"  (password must be at least {_MIN_PASSWORD_LEN} characters)")
            continue
        confirm = getpass.getpass("Confirm password: ")
        if pw != confirm:
            print("  (passwords did not match — try again)")
            continue
        return pw


def collect_root_account():
    """Prompt for the root account's username, email, and password.

    Returns a dict of APOLLO_ROOT_* env vars to write into .env. apollo.py
    reads these at startup and creates (or grants root to) the named
    account on first boot; subsequent boots only re-affirm is_root, so
    rotating the password later via the admin UI is safe.
    """
    print(
        "\n=== Root account ===\n"
        "Root can browse and delete users and reset other users'\n"
        "passwords and email addresses. It's a regular login account\n"
        "with the admin bit set.\n"
    )
    while True:
        username = prompt("Root username", default="root")
        if _USERNAME_RE.match(username):
            break
        print("  (3–32 chars, letters/digits/underscore/dot/hyphen only)")
    while True:
        email = prompt("Root email address").lower()
        if _EMAIL_RE.match(email) and len(email) <= 255:
            break
        print("  (please enter a valid email address)")
    password = prompt_password("Root password (min 8 chars)")
    return {
        "APOLLO_ROOT_USERNAME": username,
        "APOLLO_ROOT_EMAIL":    email,
        "APOLLO_ROOT_PASSWORD": password,
    }


def run(cmd):
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    subprocess.run(cmd, check=True)


def conda_available():
    return shutil.which("conda") is not None


def conda_env_exists(name):
    res = subprocess.run(
        ["conda", "env", "list"], capture_output=True, text=True, check=True
    )
    for line in res.stdout.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        # `conda env list` prints "<name>   <path>" (or with a "*" for the
        # active env). First whitespace-separated token is the name.
        if line.split()[0] == name:
            return True
    return False


def venv_python(env_path):
    if os.name == "nt":
        return env_path / "Scripts" / "python.exe"
    return env_path / "bin" / "python"


def setup_conda(packages):
    env_name   = prompt("Conda env name", default="apollo")
    py_version = prompt("Python version", default="3.11")

    if conda_env_exists(env_name):
        if not yes_no(
            f"\nConda env '{env_name}' already exists — reuse it?",
            default=True,
        ):
            sys.exit(
                "Aborting. Pick a different name or remove the existing "
                f"env with: conda env remove -n {env_name}"
            )
    else:
        print(f"\nCreating conda env '{env_name}' with Python {py_version}...")
        run(["conda", "create", "-n", env_name, f"python={py_version}", "-y"])

    # Install with pip *inside* the conda env via `conda run`. Using one
    # resolver (pip) for all packages avoids the well-known conda+pip
    # dependency-tracking conflicts.
    print(f"\nInstalling packages into '{env_name}': {', '.join(packages)}")
    run(["conda", "run", "-n", env_name, "pip", "install", *packages])

    return {
        "activate_hint": f"conda activate {env_name}",
    }


def setup_venv(packages):
    default_path = HERE / "venv"
    while True:
        env_path = Path(prompt(
            "Venv directory", default=str(default_path)
        )).expanduser().resolve()

        if not env_path.exists():
            print(f"\nCreating venv at {env_path}...")
            run([sys.executable, "-m", "venv", str(env_path)])
            break

        # Path exists — figure out whether it's actually a venv or just
        # a parent directory (e.g. PythonAnywhere's ~/.virtualenvs, which
        # holds many venvs but isn't one itself).
        if venv_python(env_path).exists():
            if yes_no(
                f"\nVenv at '{env_path}' already exists — reuse it?",
                default=True,
            ):
                break
            sys.exit(
                "Aborting. Pick a different path or remove the existing "
                f"venv: rm -rf {env_path}"
            )

        print(
            f"\n'{env_path}' exists but isn't a venv (no bin/python inside)."
        )
        # Common case: user pointed at virtualenvwrapper's WORKON_HOME
        # rather than a specific venv. Suggest a subdir named 'apollo'.
        suggested = env_path / "apollo"
        if yes_no(
            f"Create a new venv at '{suggested}' instead?", default=True
        ):
            default_path = suggested
            continue
        if not yes_no("Pick a different path?", default=True):
            sys.exit("Aborting.")
        default_path = env_path

    py = venv_python(env_path)
    if not py.exists():
        sys.exit(f"Error: expected python binary not found at {py}")

    print(f"\nInstalling packages into venv: {', '.join(packages)}")
    run([str(py), "-m", "pip", "install", "--upgrade", "pip"])
    run([str(py), "-m", "pip", "install", *packages])

    if os.name == "nt":
        activate = env_path / "Scripts" / "activate"
    else:
        activate = env_path / "bin" / "activate"
    return {
        "activate_hint": f"source {activate}",
    }


def main():
    print("=== Apollo setup ===\n")

    # Pick env manager. Default to conda when present (preserves the
    # original behavior on dev machines), otherwise venv. If the user
    # asks for conda but it isn't installed, bail with a clear message
    # rather than silently swapping it.
    has_conda = conda_available()
    default_mgr = "conda" if has_conda else "venv"
    manager = choose(
        "Environment manager?", ["conda", "venv"], default=default_mgr
    )
    if manager == "conda" and not has_conda:
        sys.exit(
            "Error: `conda` not found on PATH. Install Miniconda/Anaconda "
            "or re-run and pick 'venv'."
        )

    flavor = choose("Which flavor to install?", ["local", "server"])
    packages = BASE_PACKAGES + (SERVER_PACKAGES if flavor == "server" else [])

    if manager == "conda":
        info = setup_conda(packages)
    else:
        info = setup_venv(packages)

    # ── Env vars ──────────────────────────────────────────────────────────
    print("\n=== Environment variables ===")
    env_vars = {}

    # SECRET_KEY signs Flask sessions + CSRF tokens. Generate a strong
    # default the user can accept by pressing Enter; let them paste an
    # existing one if they're rotating or sharing across instances.
    env_vars["SECRET_KEY"] = prompt(
        "SECRET_KEY (Flask session + CSRF signing key)",
        default=token_urlsafe(32),
    )

    # Resend powers the forgot-password email. Optional at install time —
    # leaving the key blank keeps the dev fallback (apollo.py prints the
    # reset URL to its terminal instead of mailing it), which is what you
    # want before you have a Resend account or while testing offline.
    print(
        "\nResend handles password-reset emails. Get an API key at "
        "https://resend.com/api-keys\n(or leave blank to print reset "
        "links to the terminal instead of emailing them)."
    )
    resend_key = prompt("RESEND_API_KEY", default="", required=False)
    if resend_key:
        env_vars["RESEND_API_KEY"] = resend_key
        env_vars["RESEND_FROM"] = prompt(
            "RESEND_FROM (sender address — must be on a verified domain "
            "for real recipients)",
            default=DEFAULT_RESEND_FROM,
        )

    if flavor == "server":
        # FLASK_ENV=production turns off the Werkzeug debugger and makes
        # SECRET_KEY mandatory in apollo.py — both correct for a deployed
        # instance. APOLLO_BACKEND=mysql is the explicit opt-in that tells
        # apollo.py to honor DATABASE_URL; without it, the app sticks with
        # local SQLite even if DATABASE_URL happens to be set.
        env_vars["FLASK_ENV"] = "production"
        env_vars["APOLLO_BACKEND"] = "mysql"
        print(
            "\nDATABASE_URL format for MySQL:\n"
            "  mysql+pymysql://USER:PASSWORD@HOST:PORT/DBNAME\n"
            "Example: mysql+pymysql://apollo:s3cret@db.example.com:3306/apollo"
        )
        env_vars["DATABASE_URL"] = prompt("DATABASE_URL")
        # APOLLO_BASE_URL is required in production: apollo.py refuses to
        # start without it (it's the origin embedded in password-reset
        # email links). ProxyFix + request.url_root works in theory, but
        # PythonAnywhere's free-tier proxy doesn't always forward
        # X-Forwarded-Proto cleanly, which can produce http:// links in
        # HTTPS-only deployments — so we require the explicit value.
        print(
            "\nAPOLLO_BASE_URL is the public origin used in password-reset "
            "email links.\nExample: https://apolloshoots.org"
        )
        env_vars["APOLLO_BASE_URL"] = prompt("APOLLO_BASE_URL")
    else:
        # Local flavor: apollo.py always uses the file-based SQLite DB next
        # to itself unless APOLLO_BACKEND=mysql is set, so there's nothing
        # to configure here.
        pass

    # Root account — server flavor only. The local SQLite flavor is a
    # single-operator setup, so there's nobody for root to administer;
    # the app skips root bootstrap and refuses the admin routes when
    # APOLLO_BACKEND != 'mysql' anyway. Done last so any earlier
    # validation failure aborts before the user has typed their password.
    if flavor == "server":
        env_vars.update(collect_root_account())

    # ── Write .env ───────────────────────────────────────────────────────
    lines = ["# Apollo env vars — source this file before launching the app.\n"]
    for key, val in env_vars.items():
        lines.append(f"export {key}={shlex.quote(val)}\n")
    ENV_FILE.write_text("".join(lines))
    # Tighten perms — SECRET_KEY and DB credentials shouldn't be world-readable.
    try:
        os.chmod(ENV_FILE, 0o600)
    except OSError:
        pass

    print(f"\nWrote {ENV_FILE}")
    print("\n=== Done. To launch Apollo: ===")
    print(f"  source {ENV_FILE.name}")
    print(f"  {info['activate_hint']}")
    print(f"  python apollo.py")
    if flavor == "server":
        print(
            "\nFirst-run note: Apollo supports multiple user accounts.\n"
            "  • Open the deployed URL in your browser.\n"
            "  • Sign in as the root user you just configured, or click\n"
            "    'Create account' to register additional users.\n"
            "  • Any existing data from a pre-multi-user install will be\n"
            "    claimed automatically by the very first account that signs in.\n"
            "  • After the root account exists you can remove APOLLO_ROOT_PASSWORD\n"
            "    from .env — apollo.py only needs it on the bootstrap run."
        )
    else:
        print(
            "\nFirst-run note: Apollo supports multiple user accounts.\n"
            "  • Open http://127.0.0.1:5000/ in your browser.\n"
            "  • Click 'Create account' to register your first user.\n"
            "  • Any existing data from a pre-multi-user install will be\n"
            "    claimed automatically by the very first account you create."
        )
    if flavor == "server":
        # On PythonAnywhere (and most WSGI hosts) the worker process won't
        # read .env on its own — apollo.py reads from os.environ directly.
        # The reliable fix is to set the vars inside the WSGI config file
        # before the app is imported. Write a ready-to-paste snippet with
        # the actual values filled in so the user doesn't have to retype
        # secrets.
        wsgi_snippet = HERE / "wsgi_snippet.py"
        snippet_lines = [
            "# ── Paste this block at the top of your PythonAnywhere WSGI file ──\n",
            "# (Web tab → 'WSGI configuration file' link → edit)\n",
            "# Keep it ABOVE the `from apollo import app as application` line.\n",
            "import os\n",
        ]
        for key, val in env_vars.items():
            snippet_lines.append(f"os.environ[{key!r}] = {val!r}\n")
        snippet_lines.append("\n")
        snippet_lines.append("import sys\n")
        snippet_lines.append(f"project_home = {str(HERE)!r}\n")
        snippet_lines.append("if project_home not in sys.path:\n")
        snippet_lines.append("    sys.path.insert(0, project_home)\n")
        snippet_lines.append("\n")
        snippet_lines.append("from apollo import app as application\n")
        wsgi_snippet.write_text("".join(snippet_lines))
        try:
            os.chmod(wsgi_snippet, 0o600)
        except OSError:
            pass

        print(
            "\n=== PythonAnywhere setup ===\n"
            "The Web tab has no 'Environment Variables' UI — env vars must "
            "be set inside the WSGI configuration file itself, because "
            "apollo.py reads them from os.environ at import time.\n"
            "\n"
            f"A ready-to-paste WSGI file has been written to:\n"
            f"  {wsgi_snippet}\n"
            "\n"
            "On the PythonAnywhere Web tab:\n"
            "  1. Set 'Source code' to the project directory:\n"
            f"       {HERE}\n"
            "  2. Set 'Virtualenv' to the venv you just created (the path "
            "you entered above).\n"
            "  3. Click the 'WSGI configuration file' link and replace its "
            f"contents with the contents of {wsgi_snippet.name}\n"
            "  4. Click the green Reload button.\n"
            "\n"
            "Also make sure the venv you pointed the Web tab at has the same "
            "packages installed (notably `resend`, if you configured email)."
        )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled.")
    except subprocess.CalledProcessError as e:
        sys.exit(f"\nCommand failed (exit {e.returncode}): {' '.join(str(c) for c in e.cmd)}")
