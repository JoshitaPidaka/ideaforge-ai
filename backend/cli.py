"""IdeaForge CLI / agent skill.

  python cli.py check proposal.pdf                 # human-readable summary
  python cli.py check proposal.md --json           # full JSON (for other AI agents)
  python cli.py check proposal.txt --collection my-dept --top 8
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import pipeline, store  # noqa: E402
from app.parse import parse_file  # noqa: E402
from app.config import settings  # noqa: E402


async def check(path: str, collection: str) -> dict:
    p = Path(path)
    text, images = parse_file(p.name, p.read_bytes())
    pid = "cli-" + uuid.uuid4().hex[:8]
    store.save_proposal(pid, p.name, text, len(images))
    fd = pipeline.figures_dir(pid)
    fd.mkdir(parents=True, exist_ok=True)
    for i, img in enumerate(images, 1):
        (fd / f"fig_{i}.png").write_bytes(img)
    brief = await pipeline.extract_brief(pid)
    aid = await pipeline.start_analysis(pid, collection, brief)
    while aid in pipeline.RUNNING:
        await asyncio.sleep(0.2)
    return pipeline.get_result(aid)


def main() -> None:
    ap = argparse.ArgumentParser(description="IdeaForge AI: prior-art check for a project proposal")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="analyse a proposal file (PDF/DOCX/TXT/MD)")
    c.add_argument("file")
    c.add_argument("--collection", default="seed")
    c.add_argument("--top", type=int, default=settings.top_leads)
    c.add_argument("--json", action="store_true", help="print the full result as JSON")
    a = ap.parse_args()
    settings.top_leads = a.top
    r = asyncio.run(check(a.file, a.collection))
    if a.json:
        print(json.dumps(r, indent=1, ensure_ascii=False))
        return
    ins = r.get("insight") or {}
    print(f"\n{r['brief']['title']}  [{r['ai_mode']}, {r['searched']} items searched]\n")
    for k in ("overlap", "coverage", "confidence"):
        if ins.get(k):
            print(f"  {ins[k]['label']:<11} {ins[k]['level'].upper():<7} {ins[k]['explanation']}")
    print("\nContributions:")
    for ci in ins.get("contributions", []):
        print(f"  [{ci['overlap_level']:>6}] {ci['contribution']}")
    print("\nTop leads (for human review):")
    for l in r["leads"]:
        lvl = (l.get("report") or {}).get("overlap_level", "-")
        print(f"  {l['rank']:>2}. ({l['item']['type']}, {lvl}) {l['item']['title']}  {l['item']['url']}")
    if ins.get("pitch_line"):
        print(f"\nPitch line: {ins['pitch_line']}")


if __name__ == "__main__":
    main()
