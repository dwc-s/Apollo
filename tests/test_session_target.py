"""A fresh shooting session opens on the last-used face (apollo._session_start_target_id).

Runs against a throwaway SQLite DB built from the metadata, swapped in via
monkeypatch so nothing touches the dev apollo.db.
"""

import os
import sys
import tempfile

import pytest
from sqlalchemy import create_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo

U = 7373


@pytest.fixture()
def db(monkeypatch):
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    eng = create_engine(f"sqlite:///{path}", future=True)
    apollo.metadata.create_all(eng)
    monkeypatch.setattr(apollo, 'engine', eng)
    try:
        yield eng
    finally:
        eng.dispose()
        os.unlink(path)


def _mk_target(cur, name, is_default=0, is_active=1):
    cur.execute(
        "INSERT INTO targets (user_id, name, physical_size_mm, is_active, is_default) "
        "VALUES (%s, %s, 400, %s, %s)", (U, name, is_active, is_default))
    return cur.lastrowid


def _mk_shot(cur, target_id, ts):
    cur.execute(
        "INSERT INTO apollo (user_id, session_id, timestamp, target_id, x_coord, y_coord) "
        "VALUES (%s, 1, %s, %s, '1', '2')", (U, ts, target_id))


def test_defaults_to_last_used_face_not_marked_default(db):
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        default_id = _mk_target(cur, 'Default WA40', is_default=1)
        wa122_id = _mk_target(cur, 'WA 122cm 10-zone', is_default=0)
        _mk_shot(cur, default_id, '2026-05-01 10:00:00')
        _mk_shot(cur, wa122_id, '2026-05-01 11:00:00')  # most recent
        con.commit()
    assert apollo.get_default_target(U)['rowid'] == default_id
    assert apollo._last_session_target(U) == wa122_id
    assert apollo._session_start_target_id(U) == wa122_id


def test_falls_back_to_default_when_last_face_inactive(db):
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        default_id = _mk_target(cur, 'Default WA40', is_default=1)
        wa122_id = _mk_target(cur, 'WA 122cm 10-zone', is_default=0)
        _mk_shot(cur, wa122_id, '2026-05-01 11:00:00')
        con.commit()
    # Archive the last-used face → it must no longer be chosen.
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        cur.execute("UPDATE targets SET is_active = 0 WHERE id = %s AND user_id = %s",
                    (wa122_id, U))
        con.commit()
    assert apollo._last_session_target(U) is None
    assert apollo._session_start_target_id(U) == default_id


def test_no_targets_yields_none(db):
    assert apollo._session_start_target_id(U) is None
