"""End-to-end verification through the real Flask stack (routes + templates).

Drives the production code path with the Flask test client instead of 72
browser clicks: seeds a completed WA 720 and a completed WA 1440 for a test
user, then asserts the rendered pages show the handicap and classification
badges. Also exercises the account archer-profile form. Run directly:

    SECRET_KEY=test python tests/verify_e2e.py
"""

import os
import sys
from contextlib import closing
from datetime import datetime, timedelta

os.environ.setdefault("SECRET_KEY", "verify_e2e_key")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo

apollo.app.config["WTF_CSRF_ENABLED"] = False
apollo.app.config["TESTING"] = True

PREFIX = apollo.TOURNAMENT_TARGET_NAME_PREFIX
USERNAME = "verify_e2e_user"


def _conn():
    return closing(apollo.get_db_connection())


def setup_user():
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("DELETE FROM apollo WHERE user_id IN "
                    "(SELECT id FROM users WHERE username = %s)", (USERNAME,))
        cur.execute("DELETE FROM users WHERE username = %s", (USERNAME,))
        cur.execute(
            "INSERT INTO users (username, email, password_hash, created_at, "
            "is_active, gender, age_group, default_bowstyle) "
            "VALUES (%s, %s, %s, %s, 1, 'male', 'adult', 'recurve')",
            (USERNAME, "verify_e2e@example.com", "x", datetime.utcnow()))
        con.commit()
        uid = cur.execute("SELECT id FROM users WHERE username = %s",
                          (USERNAME,)).fetchone()[0]
    apollo._seed_tournament_faces(uid)
    return uid


def target_id_for(uid, face_name):
    with _conn() as con, closing(con.cursor()) as cur:
        row = cur.execute(
            "SELECT id FROM targets WHERE user_id = %s AND name = %s",
            (uid, PREFIX + face_name)).fetchone()
        return row[0] if row else None


def seed_round(uid, session_id, round_key, face_by_shot):
    """Insert center shots (all 10s) for a complete round."""
    tag = "tournament:" + round_key
    t0 = datetime.utcnow()
    with _conn() as con, closing(con.cursor()) as cur:
        for i, tid in enumerate(face_by_shot):
            apollo._insert_shot(
                cur, user_id=uid, session_id=session_id,
                timestamp=t0 + timedelta(seconds=i), bow="", arrow_type="",
                quiver_size=6, arrows_remaining=6, distance="", session_notes="",
                x="0", y="0", is_precise=1, record_mode=0, target_id=tid,
                effective_dw_session=None, session_tags=tag)
        con.commit()


def main():
    uid = setup_user()
    wa122 = target_id_for(uid, "WA 122cm 10-zone")
    wa80 = target_id_for(uid, "WA 80cm 10-zone")
    assert wa122 and wa80, f"tournament targets missing: {wa122}, {wa80}"

    # Complete WA 720 (72 arrows @ 70m, 122cm) → perfect 720.
    seed_round(uid, 9001, "wa_720_recurve", [wa122] * 72)
    # Complete WA 1440 men (90/70m on 122, 50/30m on 80) → perfect 1440.
    seed_round(uid, 9002, "wa_1440_recurve_m", [wa122] * 72 + [wa80] * 72)

    client = apollo.app.test_client()
    with client.session_transaction() as s:
        s["user_id"] = uid

    # ── Account archer-profile form ────────────────────────────────────────
    r = client.get("/account")
    html = r.get_data(as_text=True)
    assert "Archer profile" in html, "archer-profile form missing from /account"
    assert 'value="recurve" selected' in html.lower() or 'value="recurve"' in html
    print("✓ /account renders the archer-profile form")

    # POST a profile change and confirm it persists.
    r = client.post("/account", data={
        "action": "change_archer_profile",
        "gender": "female", "age_group": "50+", "default_bowstyle": "compound"})
    with _conn() as con, closing(con.cursor()) as cur:
        row = cur.execute("SELECT gender, age_group, default_bowstyle "
                          "FROM users WHERE id = %s", (uid,)).fetchone()
    assert tuple(row) == ("female", "50+", "compound"), row
    print("✓ archer-profile update persists:", tuple(row))

    # Reset profile to recurve/male/adult for the round checks below.
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("UPDATE users SET gender='male', age_group='adult', "
                    "default_bowstyle='recurve' WHERE id = %s", (uid,))
        con.commit()

    # ── WA 720 complete banner: handicap shown ─────────────────────────────
    with client.session_transaction() as s:
        s["user_id"] = uid
        s["tournament_round_key"] = "wa_720_recurve"
        s["session_id"] = 9001
        s["tournament_segment_idx"] = 0
    html = client.get("/tournament").get_data(as_text=True)
    assert "Round complete" in html, "720 not detected complete"
    assert "Handicap" in html, "handicap not shown on 720 banner"
    # Perfect 720 → AGB Elite Master Bowman (record-status) for recurve senior male.
    assert "Archery GB" in html and "Master Bowman" in html, "AGB class missing on 720"
    print("✓ WA 720 banner shows handicap + AGB classification")

    # ── WA 1440 complete banner: star + pin + AGB ──────────────────────────
    with client.session_transaction() as s:
        s["user_id"] = uid
        s["tournament_round_key"] = "wa_1440_recurve_m"
        s["session_id"] = 9002
        s["tournament_segment_idx"] = 0
    html = client.get("/tournament").get_data(as_text=True)
    assert "Purple Star" in html, "WA star award missing on 1440"
    assert "1300 Pin" in html, "USAA pin missing on 1440"
    assert "World Archery" in html and "USA Archery" in html
    print("✓ WA 1440 banner shows World Archery + USA Archery + AGB awards")

    # Cleanup.
    with _conn() as con, closing(con.cursor()) as cur:
        cur.execute("DELETE FROM apollo WHERE user_id = %s", (uid,))
        cur.execute("DELETE FROM users WHERE id = %s", (uid,))
        con.commit()
    print("\nALL E2E CHECKS PASSED")


if __name__ == "__main__":
    main()
