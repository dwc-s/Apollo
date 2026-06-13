v0.67 — The round decides the bowstyle

Starting a tournament round showed a Bowstyle picker on every round card — even
on rounds whose name already declares the bowstyle, like "WA 720 (Recurve)" or
"WA 1440 (Compound, Men)". That was redundant at best and incoherent at worst:
the picker sets the Archery GB classification category, but a WA/USAA round
whose name names a bowstyle *is* that bowstyle's round — its face and distance
only make sense for that style. Nothing stopped you picking "Compound" on the
Recurve 720 (70m/122cm) and getting graded on the compound scale, which
corresponds to no real classification. Worse, match play and after-the-fact
scoresheets never carried the picker at all, so they silently graded every
archer on the *device owner's* profile bowstyle — a compound owner logging a
recurve event would mis-classify the whole field.

This release makes the round authoritative.

- **A bowstyle-specific round fixes the classification category.** Practice,
  match play, and scoresheet entry now all derive the AGB bowstyle from the
  round's own equipment class when it names one. Score the same 600 on the
  Recurve 720 and you're graded recurve; on the Compound 720, compound — every
  time, regardless of your profile default.

- **The picker only appears where it means something.** Rounds open to any
  bowstyle (NFAA Indoor/Field/Hunter/900, Vegas, WA Field, WA Indoor 25m, JOAD)
  still show the Bowstyle dropdown, defaulting to your profile. Bowstyle-locked
  rounds drop the control entirely — the round title and the spec line already
  state it.

- **Match play and scoresheets are now coherent too.** Both previously fell
  back to the profile bowstyle; both now honour the round's declared style and
  clear any stale override carried over from a prior session.

Server-side change (a shared `_round_bowstyle` helper plus the three round-start
paths) with a one-line template guard. No schema changes, no new dependencies,
and no service-worker bump — the tournament page is server-rendered, so the fix
lands on the next page load.
