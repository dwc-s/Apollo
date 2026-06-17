#!/usr/bin/env python
"""Retype a user's bows from one bowstyle to another (e.g. recurve → barebow).

Background: bow_type is an immutable property in the UI, so a bow entered with
the wrong type can't be fixed from Edit bows. This one-off maintenance script
rewrites it directly. It reuses the app's own DB layer, so it works against
whatever backend the server runs (SQLite locally, MySQL in the cloud) and uses
the same %s paramstyle.

What it changes, scoped to ONE user and only the bows currently of --from type:
  • bows.bow_type        — the real source of truth (drives gear fields + the
                            type snapshotted onto every new shot)
  • bows.bowstyle        — legacy/duplicate column, kept in sync if present
  • apollo.bow_type      — per-shot snapshots on PAST shots (only with
                            --include-shots; otherwise history is left as-is)

SAFETY: dry-run by default. It prints exactly what it would change and touches
nothing until you re-run with --apply.

Examples
--------
  # See what would change for user 'dwcs' (recurve → barebow), no writes:
  python retype_bows.py --user dwcs

  # Apply it, and also reclassify past shots of those bows:
  python retype_bows.py --user dwcs --apply --include-shots

  # Only specific bows, by model name:
  python retype_bows.py --user dwcs --models "My Hoyt,Spigarelli" --apply
"""
import argparse
import sys
from contextlib import closing

import apollo  # imports the configured engine + DB helpers for this server


def resolve_user_id(cur, user, user_id):
    if user_id is not None:
        row = cur.execute(
            "SELECT id, username FROM users WHERE id = %s", (user_id,)
        ).fetchone()
    else:
        row = cur.execute(
            "SELECT id, username FROM users WHERE username = %s", (user,)
        ).fetchone()
    if not row:
        sys.exit(f"No such user: {user or user_id!r}")
    return int(row['id']), row['username']


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--user', help="username whose bows to retype")
    g.add_argument('--user-id', type=int, help="user id (alternative to --user)")
    g.add_argument('--list', action='store_true',
                   help="list users (id, username) and their bows, then exit")
    ap.add_argument('--from', dest='from_type', default='recurve',
                    help="current bow type to convert (default: recurve)")
    ap.add_argument('--to', dest='to_type', default='barebow',
                    help="new bow type (default: barebow)")
    ap.add_argument('--models', default=None,
                    help="comma-separated bow_model names to limit to "
                         "(default: every --from bow for the user)")
    ap.add_argument('--include-shots', action='store_true',
                    help="also rewrite bow_type on PAST shots of those bows "
                         "(reclassifies historical data in /analyze)")
    ap.add_argument('--apply', action='store_true',
                    help="actually write the change (omit for a dry run)")
    args = ap.parse_args()

    from_type, to_type = args.from_type.strip().lower(), args.to_type.strip().lower()
    if to_type not in apollo.ARCHER_BOWSTYLES:
        sys.exit(f"--to {to_type!r} is not a valid bowstyle "
                 f"(choose from: {', '.join(apollo.ARCHER_BOWSTYLES)})")
    models = ([m.strip() for m in args.models.split(',') if m.strip()]
              if args.models else None)

    with closing(apollo.get_db_connection()) as con, closing(con.cursor()) as cur:
        if args.list:
            rows = cur.execute(
                "SELECT u.id, u.username, b.bow_model, b.bow_type "
                "FROM users u LEFT JOIN bows b ON b.user_id = u.id "
                "ORDER BY u.username, b.bow_model"
            ).fetchall()
            seen = set()
            for r in rows:
                if r['id'] not in seen:
                    seen.add(r['id'])
                    print(f"[{r['id']}] {r['username']}")
                if r['bow_model']:
                    print(f"      - {r['bow_model']} ({r['bow_type']})")
            if not rows:
                print("No users found.")
            return

        uid, uname = resolve_user_id(cur, args.user, args.user_id)

        # Find the affected bows.
        sql = ("SELECT id, bow_model FROM bows "
               "WHERE user_id = %s AND LOWER(bow_type) = %s")
        params = [uid, from_type]
        if models:
            placeholders = ', '.join(['%s'] * len(models))
            sql += f" AND bow_model IN ({placeholders})"
            params += models
        bows = cur.execute(sql, tuple(params)).fetchall()

        if not bows:
            print(f"No '{from_type}' bows found for {uname} (id {uid})"
                  + (f" matching {models}" if models else "") + ". Nothing to do.")
            return

        model_names = [b['bow_model'] for b in bows]
        label = apollo.BOWSTYLE_LABELS.get(to_type, to_type.capitalize())
        from_label = apollo.BOWSTYLE_LABELS.get(from_type, from_type.capitalize())
        print(f"User {uname} (id {uid}): {len(bows)} '{from_type}' "
              f"({from_label}) bow(s) → '{to_type}' ({label}):")
        for name in model_names:
            print(f"  • {name}")

        # Count past shots that would be reclassified.
        shot_ph = ', '.join(['%s'] * len(model_names))
        shot_count = cur.execute(
            f"SELECT COUNT(*) AS n FROM apollo "
            f"WHERE user_id = %s AND LOWER(bow_type) = %s AND bow IN ({shot_ph})",
            tuple([uid, from_type] + model_names)
        ).fetchone()['n']
        if args.include_shots:
            print(f"  + {shot_count} past shot(s) will also be retyped "
                  f"(--include-shots).")
        else:
            print(f"  ({shot_count} past shot(s) keep bow_type='{from_type}'; "
                  f"pass --include-shots to retype them too.)")

        if not args.apply:
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return

        # Apply. bow_type is the real field; bowstyle is the legacy mirror.
        cur.execute(
            f"UPDATE bows SET bow_type = %s, bowstyle = %s "
            f"WHERE user_id = %s AND LOWER(bow_type) = %s "
            f"AND bow_model IN ({shot_ph})",
            tuple([to_type, to_type, uid, from_type] + model_names))
        bows_changed = cur.rowcount

        shots_changed = 0
        if args.include_shots:
            cur.execute(
                f"UPDATE apollo SET bow_type = %s "
                f"WHERE user_id = %s AND LOWER(bow_type) = %s "
                f"AND bow IN ({shot_ph})",
                tuple([to_type, uid, from_type] + model_names))
            shots_changed = cur.rowcount

        con.commit()
        print(f"\nDONE. Updated {bows_changed} bow row(s)"
              + (f" and {shots_changed} shot row(s)" if args.include_shots else "")
              + ".")


if __name__ == '__main__':
    main()
