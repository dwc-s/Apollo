"""End-to-end verification for the /form motion-capture feature.

Drives the real Flask stack: renders the page, checks the embedded checkpoint
payload varies by bowstyle, persists a derived-metrics POST (never video), and
confirms account deletion purges the form_captures rows. Run directly:

    SECRET_KEY=test python tests/verify_form_e2e.py
"""

import json
import os
import sys
from contextlib import closing
from datetime import datetime

os.environ.setdefault("SECRET_KEY", "verify_form_key")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo

apollo.app.config["WTF_CSRF_ENABLED"] = False
apollo.app.config["TESTING"] = True

USERNAME = "verify_form_user"


def _conn():
    return closing(apollo.get_db_connection())


def setup_user(is_root=0):
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("DELETE FROM form_captures WHERE user_id IN "
                    "(SELECT id FROM users WHERE username = %s)", (USERNAME,))
        cur.execute("DELETE FROM users WHERE username = %s", (USERNAME,))
        cur.execute(
            "INSERT INTO users (username, email, password_hash, created_at, "
            "is_active, is_root, gender, age_group, default_bowstyle) "
            "VALUES (%s, %s, %s, %s, 1, %s, 'male', 'adult', 'recurve')",
            (USERNAME, "verify_form@example.com", "x", datetime.utcnow(), is_root))
        con.commit()
        return cur.execute("SELECT id FROM users WHERE username = %s",
                           (USERNAME,)).fetchone()[0]


def captures_for(uid):
    with _conn() as con, closing(con.cursor()) as cur:
        return cur.execute("SELECT bowstyle, overall_score, metrics_json, "
                           "scores_json FROM form_captures WHERE user_id = %s",
                           (uid,)).fetchall()


def main():
    uid = setup_user()
    client = apollo.app.test_client()
    with client.session_transaction() as s:
        s["user_id"] = uid

    # ── GET renders, with the checkpoint payload embedded ──────────────────
    html = client.get("/form").get_data(as_text=True)
    assert "form-analyzer" in html, "analyzer root missing"
    assert "form-payload" in html, "checkpoint payload script missing"
    assert "/static/apollo-form.js" in html, "analyzer JS not included"
    # Default bowstyle follows the archer profile (recurve).
    assert 'value="recurve" selected' in html, "default bowstyle not seeded"
    print("✓ /form renders with embedded checkpoint payload (default recurve)")

    # ── Bowstyle variation: spec set differs by bowstyle (layer 4) ─────────
    rec = apollo.form_checkpoints.checkpoints_for("recurve")
    lng = apollo.form_checkpoints.checkpoints_for("longbow")
    rec_ids = {c["id"] for c in rec}
    lng_ids = {c["id"] for c in lng}
    assert "draw_elbow_elevation" in rec_ids, "recurve should have elbow-elevation"
    assert "draw_elbow_elevation" not in lng_ids, "longbow should drop elbow-elevation"
    # Traditional bands are looser than recurve for a shared checkpoint.
    rec_sl = next(c for c in rec if c["id"] == "shoulder_level")
    lng_sl = next(c for c in lng if c["id"] == "shoulder_level")
    assert lng_sl["fail"] > rec_sl["fail"], "traditional bands should be looser"
    # The GET payload carries every bowstyle's spec for client-side switching.
    html_lb = client.get("/form?bowstyle=longbow").get_data(as_text=True)
    assert 'value="longbow" selected' in html_lb, "?bowstyle override ignored"
    print(f"✓ checkpoint spec varies by bowstyle "
          f"(recurve={len(rec)}, longbow={len(lng)})")

    # Compound is a first-class bowstyle: it must be offered in the picker and
    # select its own (not recurve) checkpoints when chosen.
    assert "compound" in apollo.form_checkpoints.all_bowstyles(), \
        "compound missing from the form bowstyle list"
    html_cp = client.get("/form?bowstyle=compound").get_data(as_text=True)
    assert 'value="compound"' in html_cp and 'value="compound" selected' in html_cp, \
        "compound not offered/selected on /form"
    print("✓ compound bowstyle is offered and selectable")

    # ── Save derived metrics (never video) — POST persists a row ───────────
    # Keys are checkpoint IDs (what the client stores via measured[cp.id]) —
    # e.g. the head checkpoint id is 'head_position', not its measure 'head_tilt'.
    metrics = {"shoulder_level": 2.1, "head_position": 3.4,
               "draw_elbow_elevation": 4.0}
    scores = {"shoulder_level": {"status": "pass", "deviation": 2.1},
              "head_position": {"status": "pass", "deviation": 3.4},
              "draw_elbow_elevation": {"status": "pass", "deviation": 4.0}}
    r = client.post("/form", json={"bowstyle": "recurve", "metrics": metrics,
                                   "scores": scores, "overall_score": 92.5})
    assert r.status_code == 200 and r.get_json().get("ok"), r.get_data(as_text=True)
    rows = captures_for(uid)
    assert len(rows) == 1, f"expected 1 capture, got {len(rows)}"
    saved_bs, saved_overall, saved_metrics, saved_scores = rows[0]
    assert saved_bs == "recurve"
    assert abs(float(saved_overall) - 92.5) < 1e-6
    md = json.loads(saved_metrics)
    assert abs(md["shoulder_level"] - 2.1) < 1e-6, "metrics not round-tripped"
    assert "draw_elbow_elevation" in json.loads(saved_scores)
    print("✓ POST /form persists derived angles + scores (no video field exists)")

    # The recent-history strip now shows the saved analysis.
    html2 = client.get("/form").get_data(as_text=True)
    assert "Recent analyses" in html2, "history strip not rendered after save"
    print("✓ saved analysis appears in the recent-history strip")

    # ── Shot-to-shot consistency: needs ≥2 saved shots of a bowstyle ───────
    # One capture isn't enough to report a spread.
    assert apollo._form_consistency(
        uid, "recurve", apollo.form_checkpoints.checkpoints_for("recurve")) == [], \
        "consistency should be empty with a single capture"
    # Save a second recurve analysis with different angles → non-zero spread.
    metrics2 = {"shoulder_level": 4.1, "head_position": 1.4,
                "draw_elbow_elevation": 8.0}
    scores2 = {k: {"status": "pass", "deviation": 1.0} for k in metrics2}
    r2 = client.post("/form", json={"bowstyle": "recurve", "metrics": metrics2,
                                    "scores": scores2, "overall_score": 80.0})
    assert r2.status_code == 200 and r2.get_json().get("ok")
    cons = apollo._form_consistency(
        uid, "recurve", apollo.form_checkpoints.checkpoints_for("recurve"))
    # All three shared metrics are reported, each over both captures, in
    # checkpoint order joined to their labels.
    assert len(cons) == 3, cons
    assert all(c["n"] == 2 for c in cons), cons
    # shoulder_level: values 2.1 and 4.1 → mean 3.1, sample SD ≈ 1.414.
    sl = next(c for c in cons if c["label"] == "Level shoulders")
    assert abs(sl["mean"] - 3.1) < 1e-6 and abs(sl["sd"] - 1.4142) < 1e-3, sl
    html3 = client.get("/form").get_data(as_text=True)
    assert "Shot-to-shot consistency" in html3, "consistency table not rendered"
    print(f"✓ consistency reports per-metric mean/SD across shots "
          f"({len(cons)} metrics, e.g. {sl['label']} ±{sl['sd']:.2f})")

    # ── Replay: save a pose sequence, fetch it back, enforce ownership ─────
    replay_payload = {
        "v": 1, "lms": [11, 12, 15, 16], "hand": "right", "aspect": 1.778,
        "anchor": 1, "follow": 2, "holdStart": 0, "holdEnd": 2,
        "frames": [
            [[0.40, 0.50], [0.60, 0.50], [0.30, 0.50], [0.58, 0.50]],
            [[0.40, 0.50], [0.60, 0.50], [0.30, 0.50], [0.55, 0.50]],
            [[0.40, 0.50], [0.60, 0.50], [0.30, 0.50], [0.65, 0.50]],
        ],
    }
    rr = client.post("/form", json={
        "bowstyle": "recurve", "metrics": {"shoulder_level": 2.0},
        "scores": {"shoulder_level": {"status": "pass", "deviation": 2.0}},
        "overall_score": 90.0, "frames": replay_payload})
    assert rr.status_code == 200 and rr.get_json().get("ok")

    def latest_capture_id(u):
        with _conn() as con, closing(con.cursor()) as cur:
            row = cur.execute("SELECT id FROM form_captures WHERE user_id = %s "
                              "ORDER BY id DESC LIMIT 1", (u,)).fetchone()
            return row[0] if row else None

    cap_id = latest_capture_id(uid)
    cap = client.get(f"/form/capture/{cap_id}").get_json()
    assert cap and cap["ok"], cap
    assert cap["frames"] and cap["frames"]["anchor"] == 1, "replay frames not round-tripped"
    assert len(cap["frames"]["frames"]) == 3 and cap["frames"]["hand"] == "right"
    assert cap["scores"]["shoulder_level"]["status"] == "pass"
    # The history strip now offers a replay control for this shot.
    html_r = client.get("/form").get_data(as_text=True)
    assert f'data-replay-id="{cap_id}"' in html_r, "replay button missing for a shot with pose data"
    print("✓ replay pose sequence saved, fetched back, and offered in history")

    # Another user cannot fetch this capture (404 — ids aren't cross-account).
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("DELETE FROM users WHERE username = 'verify_form_other'")
        cur.execute(
            "INSERT INTO users (username, email, password_hash, created_at, "
            "is_active) VALUES ('verify_form_other', 'vfo@example.com', 'x', %s, 1)",
            (datetime.utcnow(),))
        con.commit()
        other = cur.execute(
            "SELECT id FROM users WHERE username = 'verify_form_other'").fetchone()[0]
    with client.session_transaction() as s:
        s["user_id"] = other
    assert client.get(f"/form/capture/{cap_id}").status_code == 404, \
        "capture must be scoped to its owner"
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (other,))
        cur.execute("DELETE FROM form_captures WHERE user_id = %s", (other,))
        con.commit()
    with client.session_transaction() as s:
        s["user_id"] = uid
    print("✓ replay capture is owner-scoped (404 for other users)")

    # Oversized replay payload is dropped (save still succeeds, no replay stored).
    big = {"v": 1, "lms": [11], "hand": "right", "aspect": 1.0,
           "anchor": 0, "follow": -1, "holdStart": -1, "holdEnd": -1,
           "frames": [[[0.123, 0.456]]] * 20000}
    rb = client.post("/form", json={
        "bowstyle": "recurve", "metrics": {"shoulder_level": 1.0},
        "scores": {"shoulder_level": {"status": "pass", "deviation": 1.0}},
        "overall_score": 99.0, "frames": big})
    assert rb.status_code == 200 and rb.get_json().get("ok")
    big_cap = client.get(f"/form/capture/{latest_capture_id(uid)}").get_json()
    assert big_cap["ok"] and big_cap["frames"] is None, "oversized replay should be dropped"
    print("✓ oversized replay payload dropped, save still succeeds")

    # ── Malformed POST is rejected ─────────────────────────────────────────
    bad = client.post("/form", json={"bowstyle": "recurve", "metrics": "nope"})
    assert bad.status_code == 400, "malformed metrics should 400"
    print("✓ malformed save rejected (400)")

    # ── Schema guarantee: form_captures has no video/blob column ───────────
    cols = {c.name for c in apollo.form_captures_table.columns}
    assert not (cols & {"video", "video_path", "blob", "frames", "raw"}), \
        f"form_captures must never store video; columns={cols}"
    print(f"✓ form_captures stores only derived data: {sorted(cols)}")

    # ── /form/author follows the existing root gate (root_required) ────────
    # On the local SQLite flavor the whole admin surface is disabled → 404 for
    # everyone (single-operator install). On MySQL it's 403 for non-root and
    # renders for root. We test whichever backend we're running on.
    root_uid = setup_user(is_root=1)
    if apollo.APOLLO_BACKEND == 'mysql':
        assert client.get("/form/author").status_code == 403, "author must be root-only"
        with client.session_transaction() as s:
            s["user_id"] = root_uid
        author_html = client.get("/form/author").get_data(as_text=True)
        assert "Learning mode" in author_html, "author page should show learning banner"
        print("✓ /form/author gated to root; renders learning banner (mysql)")
    else:
        with client.session_transaction() as s:
            s["user_id"] = root_uid
        assert client.get("/form/author").status_code == 404, \
            "author tool is cloud-only on SQLite (admin surface disabled)"
        print("✓ /form/author disabled on local SQLite (cloud-root-only, like /admin)")

    # ── Cleanup: account deletion purges form_captures (layer 6) ───────────
    # Re-create the non-root user with a capture, then purge.
    uid = setup_user()
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("INSERT INTO form_captures (user_id, created_at, bowstyle, "
                    "overall_score, metrics_json, scores_json) "
                    "VALUES (%s, %s, 'recurve', 88.0, '{}', '{}')",
                    (uid, datetime.utcnow()))
        con.commit()
    assert len(captures_for(uid)) == 1
    apollo._purge_user(uid)
    assert len(captures_for(uid)) == 0, "form_captures not purged on account delete"
    with _conn() as con, closing(con.cursor()) as cur:
        assert cur.execute("SELECT 1 FROM users WHERE id = %s",
                           (uid,)).fetchone() is None
    print("✓ account deletion purges form_captures (and the user)")

    # Tidy up the root test user.
    apollo._purge_user(root_uid)
    print("\n✓ all /form e2e checks passed")


if __name__ == "__main__":
    main()
