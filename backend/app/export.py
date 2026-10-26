"""Exports: Markdown, BibTeX, JSON and a print-ready HTML report (Save as PDF from the browser)."""
from __future__ import annotations

import html
import re

DISCLAIMER = ("These are leads for human review, found only in the selected bounded collection. "
              "They are not proof that an idea is new, copied or patentable.")


def _leads_for_export(result: dict, reviewed_only: bool) -> list[dict]:
    leads = result.get("leads", [])
    if reviewed_only:
        chosen = [l for l in leads if l.get("review") in ("relevant", "needs_reading")]
        return chosen or leads
    return leads


def markdown(result: dict, reviewed_only: bool = True) -> str:
    b, ins = result["brief"], result.get("insight") or {}
    out = [f"# IdeaForge AI report: {b.get('title')}", "", f"> {DISCLAIMER}", "",
           f"Collection: **{result['collection']}** ({result.get('searched')} items) · AI: **{result.get('model') or 'offline'}** · "
           f"Embeddings: {result.get('embedder')}", "", "## Proposal brief", ""]
    for k in ("problem", "target_users", "method", "data", "platform", "expected_outcome"):
        out.append(f"- **{k.replace('_', ' ').title()}:** {b.get(k)}")
    out += ["", "### Claimed contributions", ""] + [f"{i + 1}. {c}" for i, c in enumerate(b.get("contributions", []))]
    if ins:
        out += ["", "## Indicators", ""]
        for k in ("overlap", "coverage", "confidence"):
            out.append(f"- **{ins[k]['label']}: {ins[k]['level']}**. {ins[k]['explanation']}")
        if ins.get("headline"):
            out += ["", f"**Summary:** {ins['headline']}"]
        out += ["", "## Contribution by contribution", ""]
        for c in ins.get("contributions", []):
            out.append(f"- **{c['contribution']}**: {c['overlap_level']} overlap"
                       + (f" (leads: {', '.join(c['supporting_leads'])})" if c["supporting_leads"] else "")
                       + (f". {c['explanation']}" if c.get("explanation") else ""))
    out += ["", "## Leads", ""]
    for l in _leads_for_export(result, reviewed_only):
        it, rep = l["item"], l.get("report") or {}
        out += [f"### {it['title']} ({it['type']}{', ' + str(it['year']) if it.get('year') else ''})",
                f"{it['url']} · review: {l.get('review', 'unreviewed')} · similarity {l['similarity']:.2f}"]
        if rep:
            out += ["", rep.get("summary", ""), "", f"**Key difference:** {rep.get('key_difference', '')}", ""]
            for a in rep.get("aspects", []):
                q = f" > “{a['evidence_quote']}” {'✅' if a.get('verified') else '⚠️ unverified'}" if a.get("evidence_quote") else ""
                out.append(f"- *{a['aspect']}*: {a['relation']}. {a['explanation']}{q}")
        if l.get("note"):
            out.append(f"\n_Reviewer note:_ {l['note']}")
        out.append("")
    if ins and ins.get("gaps"):
        out += ["## Gaps", ""] + [f"- **{g['title']}**: {g['detail']}" for g in ins["gaps"]]
    if ins and ins.get("ideas"):
        out += ["", "## Differentiation ideas", ""] + [f"- **{i['title']}** ({i['effort']} effort): {i['detail']}" for i in ins["ideas"]]
    if ins and ins.get("pitch_line"):
        out += ["", "## Pitch line", "", f"> {ins['pitch_line']}"]
    return "\n".join(out) + "\n"


def bibtex(result: dict, reviewed_only: bool = True) -> str:
    entries = []
    for l in _leads_for_export(result, reviewed_only):
        it = l["item"]
        first = (it.get("authors_or_owner") or "anon").split(",")[0].split()
        word = re.sub(r"[^a-z0-9]", "", (it["title"].split() or ["x"])[0].lower())
        key = re.sub(r"[^a-z0-9]", "", (first[-1] if first else "anon").lower()) + str(it.get("year") or "") + word
        fields = {"title": it["title"], "author": it.get("authors_or_owner"), "year": it.get("year")}
        if it["type"] == "paper":
            fields.update(journal=it.get("venue_or_language"), url=it.get("url"))
        else:
            fields.update(howpublished=f"\\url{{{it['url']}}}", note="GitHub repository")
        body = ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items() if v)
        entries.append(f"@{'article' if it['type'] == 'paper' else 'misc'}{{{key},\n{body}\n}}")
    return "\n\n".join(entries) + "\n"


def html_report(result: dict, reviewed_only: bool = True) -> str:
    """Self-contained printable HTML (no extra dependency)."""
    md = markdown(result, reviewed_only)
    body = []
    for line in md.splitlines():
        e = html.escape(line)
        e = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", e)
        e = re.sub(r"(?<!\*)\*(?!\*)(.+?)\*", r"<i>\1</i>", e)
        e = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', e)
        if line.startswith("# "):
            body.append(f"<h1>{e[2:]}</h1>")
        elif line.startswith("## "):
            body.append(f"<h2>{e[3:]}</h2>")
        elif line.startswith("### "):
            body.append(f"<h3>{e[4:]}</h3>")
        elif line.startswith("&gt; "):
            body.append(f"<blockquote>{e[5:]}</blockquote>")
        elif line.startswith("- "):
            body.append(f"<li>{e[2:]}</li>")
        elif re.match(r"^\d+\. ", line):
            body.append(f"<li>{e.split('. ', 1)[1]}</li>")
        elif line.strip():
            body.append(f"<p>{e}</p>")
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>IdeaForge report</title>
<style>body{{font:14px/1.55 Inter,system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#0f172a}}
h1{{font-size:26px;background:linear-gradient(90deg,#4f46e5,#7c3aed);-webkit-background-clip:text;color:transparent}}
h2{{margin-top:28px;border-bottom:2px solid #e0e7ff;padding-bottom:4px;color:#312e81}}h3{{margin:18px 0 4px}}
blockquote{{background:#eef2ff;border-left:4px solid #4f46e5;margin:12px 0;padding:8px 14px;border-radius:6px}}
li{{margin:3px 0 3px 18px}}a{{color:#4f46e5;word-break:break-all}}@media print{{a{{color:#000}}}}</style></head>
<body>{''.join(body)}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>"""
