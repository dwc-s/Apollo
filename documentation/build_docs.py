#!/usr/bin/env python3
"""Build the styled HTML documentation set under documentation/html/.

Reads Apollo's Markdown docs (root README, documentation/FORMULAS.md, and
the documentation/tournament/*.md reference) and renders each one into a
self-contained HTML page that pulls in the app's own fonts + stylesheet,
so the docs look like the rest of Apollo. An index.html ties them
together; the Flask `/docs` route serves this directory.

Re-run after editing any of the source Markdown files:

    python documentation/build_docs.py

Requires the `markdown` package (already an Apollo dependency for this
build step; install with `pip install markdown` if missing).
"""

from __future__ import annotations

import html as _html
import os
import re

import markdown

# ── Paths ──────────────────────────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)               # repo root (parent of documentation/)
OUT_DIR = os.path.join(HERE, "html")

# Source doc → (output filename, human title, group label, one-line blurb).
DOCS = [
    ("README.md", "readme.html", "Apollo — Overview",
     "Project", "What Apollo is, how to install and run it, the backends, "
     "the schema, and a tour of every feature."),
    ("documentation/FORMULAS.md", "formulas.html", "Formulas & Math Reference",
     "Project", "Every scoring, statistical, predictive and handicap "
     "formula Apollo uses, traced to its source function."),
    ("install_help.txt", "install.html", "Install & Deploy Guide",
     "Project", "Full walkthrough of every install.py prompt, env var, and "
     "the PythonAnywhere deploy procedure."),
    ("documentation/tournament/README.md", "tournament-overview.html",
     "Tournament Mode — Overview", "Tournament",
     "How Apollo implements structured WA / NFAA / USAA rounds, and the "
     "scope of what tournament mode does and doesn't do."),
    ("documentation/tournament/rules.md", "tournament-rules.html",
     "Tournament Round Reference", "Tournament",
     "Round-by-round spec: face, distance, end size, arrows, scoring rule "
     "for every supported round."),
    ("documentation/tournament/scoring.md", "tournament-scoring.html",
     "Internal Scoring Procedures", "Tournament",
     "How shots are classified and tallied, the line-cutter rule, inner-10 "
     "handling, and live multi-archer match play."),
    ("documentation/tournament/targets.md", "tournament-targets.html",
     "Tournament Target Faces", "Tournament",
     "Ring radii and image-asset map for every seeded tournament face."),
]

# Docs that are plain text (rendered verbatim in a <pre>) rather than Markdown.
PLAINTEXT = {"install_help.txt"}

# Rewrite Markdown cross-references to their generated HTML filenames.
LINK_MAP = {
    "../FORMULAS.md": "formulas.html",
    "documentation/FORMULAS.md": "formulas.html",
    "FORMULAS.md": "formulas.html",
    "documentation/tournament/": "tournament-overview.html",
    "tournament/README.md": "tournament-overview.html",
    "README.md": "readme.html",
    "rules.md": "tournament-rules.html",
    "scoring.md": "tournament-scoring.html",
    "targets.md": "tournament-targets.html",
    "install_help.txt": "install.html",
}

# ── Page shell ─────────────────────────────────────────────────────────
PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Apollo Docs · {title}</title>
    <link rel="stylesheet" href="/static/fonts/apollo-fonts.css">
    <link rel="stylesheet" type="text/css" href="/static/style.css">
    <style>{css}</style>
</head>
<body class="docs-body">
    <aside class="docs-sidebar">
        <a href="/" class="side-nav-brand">Apollo</a>
        <div class="docs-sidebar-label">Documentation</div>
{nav}
        <div class="docs-sidebar-foot">
            <a href="/" class="docs-back">‹ Back to app</a>
        </div>
    </aside>
    <main class="docs-main">
        <div class="docs-card">
{body}
        </div>
        <p class="docs-footer">Apollo documentation · generated from the
        project Markdown by <code>documentation/build_docs.py</code>.</p>
    </main>
</body>
</html>
"""

# Doc-specific styling, layered on top of the app's style.css. Colours are
# lifted straight from the Apollo palette so the docs feel native.
CSS = """
.docs-body { padding: 0; padding-left: 240px; }
.docs-sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; width: 200px;
    background-color: #b3c6e3; padding: 22px 16px; box-sizing: border-box;
    overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
    box-shadow: 2px 0 8px rgba(99, 106, 128, 0.18); z-index: 500;
}
.docs-sidebar-label {
    font-family: "Quantico", sans-serif; font-weight: 700; font-size: 0.7rem;
    letter-spacing: 0.12em; text-transform: uppercase; color: #5a6a86;
    margin: 4px 6px 6px;
}
.docs-sidebar .docs-nav-group {
    font-family: "Quantico", sans-serif; font-weight: 700; font-size: 0.68rem;
    letter-spacing: 0.1em; text-transform: uppercase; color: #7a89a6;
    margin: 12px 6px 2px;
}
.docs-sidebar a.docs-nav-link {
    display: block; padding: 6px 8px; border-radius: 6px;
    font-family: "Quantico", sans-serif; font-weight: 700; font-size: 0.82rem;
    color: #1a3a5c; text-decoration: none; transition: background-color 0.15s;
}
.docs-sidebar a.docs-nav-link:hover { background-color: #95abcf; }
.docs-sidebar a.docs-nav-link.active { background-color: #95abcf; }
.docs-sidebar-foot { margin-top: auto; padding-top: 12px; }
.docs-sidebar a.docs-back {
    font-family: "Quantico", sans-serif; font-weight: 700; font-size: 0.82rem;
    color: #5a6a86; text-decoration: none;
}
.docs-sidebar a.docs-back:hover { text-decoration: underline; }

.docs-main { max-width: 920px; margin: 0 auto; padding: 28px 24px 60px; }
.docs-card {
    background-color: #eaf2fb; border-radius: 16px; padding: 36px 44px;
    box-shadow: 0 2px 10px rgba(99, 106, 128, 0.18);
    font-family: "Quantico", sans-serif; color: #243b54; line-height: 1.6;
}
.docs-card h1 {
    font-family: "Bungee Shade", sans-serif; color: #a1d8ed;
    -webkit-text-stroke: 1.5px #636a80; font-size: 2.5rem; line-height: 1.15;
    margin: 0 0 22px;
}
.docs-card h2 {
    font-family: "Quantico", sans-serif; font-weight: 700; color: #1a3a5c;
    font-size: 1.5rem; margin: 34px 0 12px; padding-bottom: 6px;
    border-bottom: 2px solid #b3c6e3;
}
.docs-card h3 {
    font-family: "Quantico", sans-serif; font-weight: 700; color: #1a3a5c;
    font-size: 1.15rem; margin: 24px 0 8px;
}
.docs-card h4 { color: #1a3a5c; margin: 18px 0 6px; }
.docs-card p, .docs-card li { font-size: 0.95rem; }
.docs-card a { color: #3a6ea5; text-decoration: none; }
.docs-card a:hover { text-decoration: underline; }
.docs-card code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background-color: #d6e4f0; color: #1a3a5c; padding: 1px 6px;
    border-radius: 4px; font-size: 0.86em;
}
.docs-card pre {
    background-color: #1a3a5c; color: #d6e4f0; padding: 16px 18px;
    border-radius: 10px; overflow-x: auto; line-height: 1.45;
}
.docs-card pre code { background: none; color: inherit; padding: 0; }
.docs-card pre.docs-plaintext {
    white-space: pre-wrap; word-break: break-word; font-size: 0.82rem;
}
.docs-card blockquote {
    margin: 16px 0; padding: 8px 18px; border-left: 4px solid #95abcf;
    background-color: #dde9f6; border-radius: 0 8px 8px 0; color: #33506e;
}
.docs-card table {
    border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 0.88rem;
}
.docs-card th, .docs-card td {
    border: 1px solid #b3c6e3; padding: 7px 11px; text-align: left;
    vertical-align: top;
}
.docs-card th { background-color: #b3c6e3; color: #1a3a5c; font-weight: 700; }
.docs-card tr:nth-child(even) td { background-color: #e1ecf8; }
.docs-card hr { border: 0; border-top: 1px solid #b3c6e3; margin: 28px 0; }
.docs-footer {
    text-align: center; font-family: "Quantico", sans-serif; font-size: 0.78rem;
    color: #5a6a86; margin-top: 22px;
}

/* index */
.docs-index-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px; margin: 8px 0 6px;
}
.docs-index-card {
    display: block; background-color: #dde9f6; border-radius: 12px;
    padding: 18px 20px; text-decoration: none; color: #1a3a5c;
    border: 1px solid #c2d3ea; transition: transform 0.12s, box-shadow 0.12s;
}
.docs-index-card:hover {
    transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,106,128,0.22);
    text-decoration: none;
}
.docs-index-card .t {
    font-family: "Quantico", sans-serif; font-weight: 700; font-size: 1.05rem;
    color: #1a3a5c; display: block; margin-bottom: 6px;
}
.docs-index-card .d { font-size: 0.86rem; color: #3f5b78; }

@media (max-width: 760px) {
    .docs-body { padding-left: 0; }
    .docs-sidebar {
        position: static; width: auto; box-shadow: none; flex-direction: row;
        flex-wrap: wrap; align-items: center;
    }
    .docs-sidebar-foot { margin: 0 0 0 auto; }
    .docs-main { padding: 18px 14px 40px; }
    .docs-card { padding: 24px 20px; }
}
"""

MD_EXTENSIONS = ["extra", "tables", "fenced_code", "sane_lists", "toc", "attr_list"]


def build_nav(active: str) -> str:
    """Sidebar nav HTML, grouping pages by their group label."""
    lines = []
    lines.append('        <a href="index.html" class="docs-nav-link'
                 + (" active" if active == "index.html" else "") + '">Home</a>')
    last_group = None
    for _src, out, title, group, _blurb in DOCS:
        if group != last_group:
            lines.append(f'        <div class="docs-nav-group">{group}</div>')
            last_group = group
        # Drop the redundant group prefix from the visible link label.
        label = title.split("—")[-1].strip() if "—" in title else title
        cls = "docs-nav-link active" if out == active else "docs-nav-link"
        lines.append(f'        <a href="{out}" class="{cls}">{label}</a>')
    return "\n".join(lines)


def rewrite_links(html: str) -> str:
    """Point Markdown cross-references at the generated HTML files."""
    def repl(match: re.Match) -> str:
        href = match.group(1)
        # Strip any :line suffix and anchor for matching.
        base = href.split("#")[0]
        line_anchor = href[len(base):]
        base_noline = re.sub(r":\d+$", "", base)
        for needle, target in LINK_MAP.items():
            if base_noline.endswith(needle) or base_noline == needle:
                return f'href="{target}{line_anchor}"'
        return match.group(0)
    return re.sub(r'href="([^"]+)"', repl, html)


def render_body(md_text: str) -> str:
    md = markdown.Markdown(extensions=MD_EXTENSIONS)
    html = md.convert(md_text)
    return rewrite_links(html)


def build_index() -> str:
    cards = []
    for _src, out, title, group, blurb in DOCS:
        cards.append(
            f'  <a class="docs-index-card" href="{out}">'
            f'<span class="t">{title}</span>'
            f'<span class="d">{blurb}</span></a>'
        )
    grid = "\n".join(cards)
    return (
        "<h1>Apollo Documentation</h1>\n"
        "<p>Reference for Apollo — the archery practice logger and analyzer. "
        "These pages are generated from the project's Markdown sources and "
        "track the current build.</p>\n"
        f'<div class="docs-index-grid">\n{grid}\n</div>\n'
    )


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    # Index page.
    with open(os.path.join(OUT_DIR, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(PAGE.format(title="Home", css=CSS,
                             nav=build_nav("index.html"), body=build_index()))
    written = ["index.html"]

    # One page per source doc.
    for src, out, title, _group, _blurb in DOCS:
        src_path = os.path.join(ROOT, src)
        if not os.path.exists(src_path):
            print(f"  ! missing source, skipped: {src}")
            continue
        with open(src_path, encoding="utf-8") as fh:
            raw = fh.read()
        if src in PLAINTEXT:
            body = (f"<h1>{title}</h1>\n<pre class=\"docs-plaintext\">"
                    f"{_html.escape(raw)}</pre>")
        else:
            body = render_body(raw)
        with open(os.path.join(OUT_DIR, out), "w", encoding="utf-8") as fh:
            fh.write(PAGE.format(title=title, css=CSS,
                                 nav=build_nav(out), body=body))
        written.append(out)

    print(f"Built {len(written)} pages into {OUT_DIR}:")
    for name in written:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
