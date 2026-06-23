"""Tests for the idempotent additive import merge (apollo._apply_import).

Each test runs against a throwaway SQLite DB built from the SQLAlchemy
metadata, swapped in via monkeypatch so nothing touches the dev apollo.db.
The merge's guarantees under test:

  * re-importing the same file is a no-op (modern uuid'd shots *and* legacy
    uuid-less shots dedupe);
  * inventory dedupes on its natural name key (targets reused, bows/arrows
    skipped) and target zones aren't duplicated for a reused target;
  * a continued session merges into the existing one (no split, no duplicate
    session_times) via begin-time matching;
  * the retry wrapper recovers from a session_id collision but lets any other
    integrity error surface.
"""

import os
import sys
import tempfile

import pytest
from sqlalchemy import create_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apollo
from apollo import DBIntegrityError

U = 4242  # arbitrary importer user id
BEGIN = '2026-03-04 10:00:00.000000'


@pytest.fixture()
def db(monkeypatch):
    """Fresh empty SQLite DB wired into apollo via the module-global engine."""
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


def _count(table):
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        return cur.execute(
            f"SELECT COUNT(*) FROM {table} WHERE user_id = %s", (U,)
        ).fetchone()[0]


def _session_ids():
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        return {r[0] for r in cur.execute(
            "SELECT DISTINCT session_id FROM apollo WHERE user_id = %s", (U,)
        ).fetchall()}


def _shot(uuid=None, x='1', y='2', ts=BEGIN, sid=1, target_id=5):
    row = {'session_id': sid, 'timestamp': ts, 'bow': 'B', 'arrow_type': 'A',
           'distance': '18', 'x_coord': x, 'y_coord': y, 'target_id': target_id}
    if uuid is not None:
        row['client_uuid'] = uuid
    return row


def _data(shots):
    return {
        'targets': [{'id': 5, 'name': 'Tgt', 'physical_size_mm': 400}],
        'target_zones': [{'target_id': 5, 'name': '10', 'point_value': 10,
                          'radius_mm': 20, 'display_order': 0}],
        'bows': [{'bow_model': 'B', 'bow_type': 'recurve'}],
        'arrows': [{'arrow': 'A'}],
        'session_times': [{'session_id': 1, 'session_begin_time': BEGIN}],
        'apollo': list(shots),
    }


def test_fresh_import_inserts_everything(db):
    counts = apollo._apply_import(_data([_shot(uuid='u1'), _shot(uuid='u2', x='3')]), U)
    assert counts == {'targets': 1, 'target_zones': 1, 'bows': 1,
                      'arrows': 1, 'session_times': 1, 'apollo': 2}


def test_reimport_uuid_shots_is_noop(db):
    data = _data([_shot(uuid='u1'), _shot(uuid='u2', x='3')])
    apollo._apply_import(data, U)
    counts = apollo._apply_import(data, U)
    assert sum(counts.values()) == 0
    assert _count('apollo') == 2 and _count('session_times') == 1
    assert _count('targets') == 1 and _count('bows') == 1


def test_reimport_legacy_uuidless_shots_is_noop(db):
    # No client_uuid → must dedupe on the natural key (begin, ts, x, y).
    data = _data([_shot(x='1'), _shot(x='5', ts='2026-03-04 10:01:00.000000')])
    apollo._apply_import(data, U)
    counts = apollo._apply_import(data, U)
    assert counts['apollo'] == 0
    assert _count('apollo') == 2


def test_continued_session_merges_not_splits(db):
    data = _data([_shot(uuid='u1')])
    apollo._apply_import(data, U)
    # Same session (same begin-time) gains a new shot on a later import.
    data['apollo'].append(_shot(uuid='u2', x='7'))
    counts = apollo._apply_import(data, U)
    assert counts['apollo'] == 1 and counts['session_times'] == 0
    assert _count('apollo') == 2
    assert len(_session_ids()) == 1  # merged into the one existing session


def test_inventory_dedupe_reuses_target_and_skips_bow_arrow(db):
    apollo._apply_import(_data([_shot(uuid='u1')]), U)
    # Second file: same target name + bow + arrow, a brand-new shot.
    counts = apollo._apply_import(_data([_shot(uuid='u2', x='9')]), U)
    assert counts['targets'] == 0 and counts['bows'] == 0 and counts['arrows'] == 0
    assert counts['target_zones'] == 0  # reused target keeps its existing zones
    assert _count('targets') == 1 and _count('target_zones') == 1
    # The new shot points at the single real target row.
    with apollo.closing(apollo.get_db_connection()) as con, \
            apollo.closing(con.cursor()) as cur:
        tid = cur.execute(
            "SELECT id FROM targets WHERE user_id = %s", (U,)).fetchone()[0]
        wrong = cur.execute(
            "SELECT COUNT(*) FROM apollo WHERE user_id = %s AND target_id <> %s",
            (U, tid)).fetchone()[0]
    assert wrong == 0


def test_retry_recovers_transient_collision(monkeypatch):
    # A unique-index collision (session id, client_uuid, target name…) on the
    # first attempt is retried; the second attempt — which would re-dedupe
    # against the now-committed row — succeeds.
    calls = {'n': 0}

    def flaky(data, user_id):
        calls['n'] += 1
        if calls['n'] == 1:
            raise DBIntegrityError("stmt", {}, Exception(
                "UNIQUE constraint failed: session_times.user_id, "
                "session_times.session_id"))
        return {'apollo': 1}

    monkeypatch.setattr(apollo, '_apply_import_once', flaky)
    assert apollo._apply_import({}, U) == {'apollo': 1}
    assert calls['n'] == 2


def test_persistent_integrity_error_surfaces_after_cap(monkeypatch):
    # A deterministic integrity failure isn't masked — it surfaces once the
    # retry cap (5) is exhausted.
    calls = {'n': 0}

    def hard(data, user_id):
        calls['n'] += 1
        raise DBIntegrityError("stmt", {}, Exception(
            "UNIQUE constraint failed: apollo.client_uuid"))

    monkeypatch.setattr(apollo, '_apply_import_once', hard)
    with pytest.raises(DBIntegrityError):
        apollo._apply_import({}, U)
    assert calls['n'] == 5
