# Apollo Tournament Mode — Rules & Internal Procedures

This directory documents how Apollo implements **tournament mode** — a
structured-session variant of `/sesh` that mirrors the formats, scoring,
and target faces of the three major archery organizations:

- **World Archery (WA)** — international federation, Olympic round, FITA.
- **NFAA** — National Field Archery Association (USA).
- **USAA** — USA Archery, the WA member federation in the United States.

The goal is not to be a digital referee — Apollo is a *personal logging*
tool. The goal is to let a user dial in a round (e.g. "WA 720 Recurve"),
have Apollo enforce the right end size / ends / target face / scoring
rule, and produce a score at the end that matches what they would have
written on the paper scorecard.

> **Warning — verify before competition.** Rules change between rulebook
> editions (typically annually). The specifications captured here are
> drawn from published rulebook conventions current as of mid-2026 and
> should be **re-verified against the current official rulebook PDFs**
> before any score recorded here is treated as authoritative for
> competition purposes. Apollo is a practice tool.

The documents in this directory:

- **`rules.md`** — round-by-round reference: target face, distance,
  end size, total arrows, time limit, scoring rule, organization
  citation.
- **`scoring.md`** — Apollo's internal scoring procedures: how shots
  are classified, how the line-cutter rule is implemented, how inner-10
  (X) is tracked, how compound vs. recurve modes diverge, how end totals
  and round totals are computed and persisted.
- **`targets.md`** — target face specifications (ring radii, face size,
  3-spot layout) and which static image asset under `static/targets/`
  represents each face.

Sources used (canonical rulebook URLs — verify before relying):

- World Archery Rulebook (Books 1–5): https://www.worldarchery.sport/rulebook
- NFAA Constitution & By-Laws / rules: https://www.nfaausa.com/rules
- USA Archery rules & sanctioned events: https://www.usarchery.org/rules
- NASP (National Archery in the Schools Program): https://naspschools.org/
