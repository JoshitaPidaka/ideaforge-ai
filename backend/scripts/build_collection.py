"""Build the bounded seed collection of papers and project descriptions.

Sources:
  - GitHub repositories (project descriptions: README excerpt + metadata)
  - OpenAlex works (papers with abstracts)
  - arXiv (papers with abstracts)

Usage:
  python scripts/build_collection.py                      # all sources, default topics
  python scripts/build_collection.py --sources github     # one source only
  python scripts/build_collection.py --per-topic 30 --out ../data/collection/seed.jsonl

Sources that cannot be reached are skipped with a warning; items already in the
output file are kept and de-duplicated by id, so you can run it again later to add papers.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import httpx

DEFAULT_TOPICS = [
    "AI study assistant flashcards quiz generation",
    "campus chatbot retrieval augmented generation documents",
    "plant disease detection deep learning mobile",
    "symptom checker healthcare triage machine learning",
    "crop recommendation smart agriculture IoT",
    "sign language recognition accessibility",
    "credit card fraud detection machine learning",
    "citizen complaint grievance classification NLP",
    "code repository question answering LLM",
    "resume screening job matching NLP",
    "mental health chatbot conversational AI",
    "traffic prediction smart city deep learning",
]

NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")
README_CHARS = 4000


def clean_markdown(md: str) -> str:
    md = re.sub(r"<!--.*?-->", " ", md, flags=re.S)
    md = re.sub(r"```.*?```", " ", md, flags=re.S)          # code blocks
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)            # images
    md = re.sub(r"<img[^>]*>", " ", md, flags=re.I)
    md = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", " ", md)  # badges
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)         # links -> text
    md = re.sub(r"<[^>]+>", " ", md)                          # html tags
    md = re.sub(r"^#+\s*", "", md, flags=re.M)
    md = re.sub(r"[*_`>|]+", " ", md)
    md = re.sub(r"[ \t]+", " ", md)
    md = re.sub(r"\n\s*\n+", "\n", md)
    return md.strip()


# --------------------------------------------------------------------------- GitHub
async def github_topic(client: httpx.AsyncClient, topic: str, n: int) -> list[dict]:
    q = f"{topic} in:name,description,readme stars:>3"
    r = await client.get("https://api.github.com/search/repositories",
                         params={"q": q, "sort": "stars", "order": "desc", "per_page": n})
    if r.status_code != 200:
        print(f"  ! github search failed for '{topic}': {r.status_code}", file=sys.stderr)
        return []
    items = []
    for repo in r.json().get("items", []):
        items.append({"repo": repo, "topic": topic})
    return items


async def github_readme(client: httpx.AsyncClient, full_name: str) -> str:
    r = await client.get(f"https://api.github.com/repos/{full_name}/readme")
    if r.status_code != 200:
        return ""
    try:
        return base64.b64decode(r.json()["content"]).decode("utf-8", "ignore")
    except Exception:
        return ""


async def fetch_github(topics: list[str], per_topic: int) -> list[dict]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "ideaforge-ai"}
    if os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    out: list[dict] = []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        found: dict[str, dict] = {}
        for t in topics:  # sequential: search API is rate limited
            for it in await github_topic(client, t, per_topic):
                found.setdefault(it["repo"]["full_name"], it)
            await asyncio.sleep(2.2)
        print(f"  github: {len(found)} repos, fetching READMEs…")
        sem = asyncio.Semaphore(8)

        async def one(name: str, it: dict):
            async with sem:
                readme = clean_markdown(await github_readme(client, name))
            repo = it["repo"]
            desc = repo.get("description") or ""
            text = (desc + "\n" + readme)[:README_CHARS].strip()
            if len(text) < 120:
                return None
            return {
                "id": f"proj:{name}",
                "type": "project",
                "title": repo["name"].replace("-", " ").replace("_", " "),
                "text": text,
                "authors_or_owner": repo["owner"]["login"],
                "year": int((repo.get("created_at") or NOW)[:4]),
                "venue_or_language": repo.get("language") or "",
                "url": repo["html_url"],
                "tags": (repo.get("topics") or [])[:8],
                "meta": {
                    "full_name": name,
                    "description": desc,
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "pushed_at": repo.get("pushed_at"),
                    "license": (repo.get("license") or {}).get("spdx_id"),
                    "seed_topic": it["topic"],
                },
                "source": "github",
                "fetched_at": NOW,
            }

        res = await asyncio.gather(*(one(n, it) for n, it in found.items()))
        out = [r for r in res if r]
    return out


# --------------------------------------------------------------------------- awesome lists (no API needed)
AWESOME_LISTS = [
    "Danielskry/Awesome-RAG", "kakoni/awesome-healthcare", "brycejohnston/awesome-agriculture",
    "e2b-dev/awesome-ai-agents", "Hannibal046/Awesome-LLM", "mahmoud/awesome-python-applications",
    "josephmisiti/awesome-machine-learning", "ChristosChristofidis/awesome-deep-learning",
    "jbhuang0604/awesome-computer-vision", "keon/awesome-nlp", "steven2358/awesome-generative-ai",
    "RunaCapital/awesome-oss-alternatives",
]
SKIP_OWNERS = {"sponsors", "topics", "features", "orgs", "apps", "marketplace", "about", "collections"}


async def fetch_awesome(topics: list[str], per_topic: int) -> list[dict]:
    """Discover repos linked from curated awesome lists and fetch their real READMEs via raw.githubusercontent.com.

    Used when the GitHub REST API is unavailable. Star/fork metadata is not available in this mode.
    """
    per_list = max(per_topic, 40)
    out = []
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        sem = asyncio.Semaphore(12)

        async def raw_readme(full: str) -> str:
            for name in ("README.md", "readme.md", "Readme.md", "README.rst"):
                async with sem:
                    r = await client.get(f"https://raw.githubusercontent.com/{full}/HEAD/{name}")
                if r.status_code == 200:
                    return r.text
            return ""

        for lst in AWESOME_LISTS:
            md = await raw_readme(lst)
            names: list[str] = []
            for owner, repo in re.findall(r"github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)", md):
                repo = repo.removesuffix(".git").rstrip(".")
                full = f"{owner}/{repo}"
                if (owner.lower() in SKIP_OWNERS or full == lst or full in names
                        or "awesome" in repo.lower() or repo.lower() in ("readme.md", "blob", "wiki")):
                    continue
                names.append(full)
            names = names[:per_list]
            print(f"  {lst}: {len(names)} linked repos")

            async def one(full: str, lst=lst):
                text = clean_markdown(await raw_readme(full))[:README_CHARS]
                if len(text) < 200:
                    return None
                owner, repo = full.split("/")
                return {
                    "id": f"proj:{full}", "type": "project",
                    "title": repo.replace("-", " ").replace("_", " "),
                    "text": text, "authors_or_owner": owner, "year": None,
                    "venue_or_language": "", "url": f"https://github.com/{full}", "tags": [],
                    "meta": {"full_name": full, "listed_in": lst},
                    "source": "github", "fetched_at": NOW,
                }

            out += [r for r in await asyncio.gather(*(one(n) for n in names)) if r]
    return out


# --------------------------------------------------------------------------- OpenAlex
def _abstract(inv: dict | None) -> str:
    if not inv:
        return ""
    pos = []
    for word, idxs in inv.items():
        for i in idxs:
            pos.append((i, word))
    return " ".join(w for _, w in sorted(pos))


async def fetch_openalex(topics: list[str], per_topic: int) -> list[dict]:
    out = []
    mail = os.getenv("OPENALEX_MAILTO", "ideaforge@example.org")
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": f"ideaforge-ai (mailto:{mail})"}) as client:
        for t in topics:
            r = await client.get("https://api.openalex.org/works", params={
                "search": t, "per-page": per_topic, "filter": "has_abstract:true,from_publication_date:2015-01-01",
                "sort": "relevance_score:desc", "mailto": mail})
            r.raise_for_status()
            for w in r.json().get("results", []):
                abstract = _abstract(w.get("abstract_inverted_index"))
                if len(abstract) < 200:
                    continue
                venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
                out.append({
                    "id": f"paper:{w['id'].rsplit('/', 1)[-1]}",
                    "type": "paper",
                    "title": w.get("display_name") or "",
                    "text": abstract[:README_CHARS],
                    "authors_or_owner": ", ".join(a["author"]["display_name"] for a in (w.get("authorships") or [])[:4]),
                    "year": w.get("publication_year"),
                    "venue_or_language": venue,
                    "url": w.get("doi") or w["id"],
                    "tags": [c["display_name"] for c in (w.get("concepts") or [])[:6]],
                    "meta": {"citations": w.get("cited_by_count", 0), "doi": w.get("doi"), "seed_topic": t},
                    "source": "openalex",
                    "fetched_at": NOW,
                })
    return out


# --------------------------------------------------------------------------- arXiv
async def fetch_arxiv(topics: list[str], per_topic: int) -> list[dict]:
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    async with httpx.AsyncClient(timeout=40) as client:
        for t in topics:
            q = " AND ".join(f"all:{w}" for w in t.split()[:4])
            r = await client.get("https://export.arxiv.org/api/query",
                                 params={"search_query": q, "max_results": per_topic, "sortBy": "relevance"})
            r.raise_for_status()
            root = ET.fromstring(r.text)
            for e in root.findall("a:entry", ns):
                aid = e.findtext("a:id", "", ns).rsplit("/abs/", 1)[-1]
                summary = " ".join(e.findtext("a:summary", "", ns).split())
                out.append({
                    "id": f"paper:arxiv:{aid}",
                    "type": "paper",
                    "title": " ".join(e.findtext("a:title", "", ns).split()),
                    "text": summary[:README_CHARS],
                    "authors_or_owner": ", ".join(a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)[:4]),
                    "year": int(e.findtext("a:published", "0000", ns)[:4]),
                    "venue_or_language": "arXiv",
                    "url": f"https://arxiv.org/abs/{aid}",
                    "tags": [c.get("term") for c in e.findall("a:category", ns)][:6],
                    "meta": {"seed_topic": t},
                    "source": "arxiv",
                    "fetched_at": NOW,
                })
            await asyncio.sleep(3)  # arXiv asks for 3s between calls
    return out


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default="github,openalex,arxiv")
    ap.add_argument("--per-topic", type=int, default=25)
    ap.add_argument("--topics", default="", help="semicolon-separated topics (default: built-in list)")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "data/collection/seed.jsonl"))
    args = ap.parse_args()
    topics = [t.strip() for t in args.topics.split(";") if t.strip()] or DEFAULT_TOPICS
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    existing: dict[str, dict] = {}
    if out.exists():
        for line in out.read_text().splitlines():
            if line.strip():
                it = json.loads(line)
                existing[it["id"]] = it
        print(f"existing items: {len(existing)}")

    fetchers = {"github": fetch_github, "awesome": fetch_awesome, "openalex": fetch_openalex, "arxiv": fetch_arxiv}
    for src in [s.strip() for s in args.sources.split(",") if s.strip()]:
        print(f"→ {src}")
        try:
            items = await fetchers[src](topics, args.per_topic)
        except Exception as e:  # network blocked, rate limited…
            print(f"  ! skipped {src}: {type(e).__name__}: {e}", file=sys.stderr)
            continue
        for it in items:
            existing[it["id"]] = it
        print(f"  + {len(items)} items")

    with out.open("w") as f:
        for it in existing.values():
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    by_type: dict[str, int] = {}
    for it in existing.values():
        by_type[it["type"]] = by_type.get(it["type"], 0) + 1
    print(f"wrote {len(existing)} items to {out} {by_type}")


if __name__ == "__main__":
    asyncio.run(main())
