"""Live discovery connectors: OpenAlex + arXiv (papers), PatentsView (patents), GitHub (repositories).

Every connector returns (items, status). When a source cannot be reached the status says so and the caller
falls back to the local bounded collection; nothing is ever invented.
"""
from __future__ import annotations

import asyncio
import base64
import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

from .schemas import Item

UA = {"User-Agent": "ideaforge-ai/2.0 (hackathon research assistant)"}
NOW = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")  # noqa: E731


def _status(source: str, ok: bool, count: int = 0, error: str = "", note: str = "") -> dict:
    return {"source": source, "ok": ok, "count": count, "error": error, "note": note, "at": NOW()}


def _abstract(inv: dict | None) -> str:
    if not inv:
        return ""
    pos = [(i, w) for w, idxs in inv.items() for i in idxs]
    return " ".join(w for _, w in sorted(pos))


# ------------------------------------------------------------------ papers
async def openalex(query: str, limit: int = 20, year_from: int | None = None) -> tuple[list[Item], dict]:
    filt = "has_abstract:true" + (f",from_publication_date:{year_from}-01-01" if year_from else "")
    mail = os.getenv("OPENALEX_MAILTO", "ideaforge@example.org")
    try:
        async with httpx.AsyncClient(timeout=20, headers=UA) as c:
            r = await c.get("https://api.openalex.org/works", params={"search": query, "per-page": limit, "filter": filt, "mailto": mail})
            r.raise_for_status()
        out = []
        for w in r.json().get("results", []):
            ab = _abstract(w.get("abstract_inverted_index"))
            if len(ab) < 120:
                continue
            loc = (w.get("primary_location") or {})
            oa = (w.get("open_access") or {})
            out.append(Item(
                id=f"paper:{w['id'].rsplit('/', 1)[-1]}", type="paper", title=w.get("display_name") or "", text=ab[:4000],
                authors_or_owner=", ".join(a["author"]["display_name"] for a in (w.get("authorships") or [])[:5]),
                year=w.get("publication_year"), venue_or_language=((loc.get("source") or {}).get("display_name") or ""),
                url=w.get("doi") or w["id"], tags=[c["display_name"] for c in (w.get("concepts") or [])[:6]],
                meta={"citations": w.get("cited_by_count", 0), "doi": w.get("doi"), "open_access": oa.get("is_oa"),
                      "oa_url": oa.get("oa_url"), "kind": w.get("type")},
                source="openalex", fetched_at=NOW()))
        return out, _status("OpenAlex", True, len(out))
    except Exception as e:
        return [], _status("OpenAlex", False, error=f"{type(e).__name__}: {str(e)[:120]}")


async def arxiv(query: str, limit: int = 15, year_from: int | None = None) -> tuple[list[Item], dict]:
    ns = {"a": "http://www.w3.org/2005/Atom"}
    words = [w for w in re.findall(r"[A-Za-z0-9-]+", query) if len(w) > 2][:6]
    try:
        async with httpx.AsyncClient(timeout=25, headers=UA) as c:
            r = await c.get("https://export.arxiv.org/api/query",
                            params={"search_query": " AND ".join(f"all:{w}" for w in words), "max_results": limit, "sortBy": "relevance"})
            r.raise_for_status()
        out = []
        for e in ET.fromstring(r.text).findall("a:entry", ns):
            aid = e.findtext("a:id", "", ns).rsplit("/abs/", 1)[-1]
            year = int(e.findtext("a:published", "0000", ns)[:4] or 0)
            if year_from and year < year_from:
                continue
            out.append(Item(
                id=f"paper:arxiv:{aid}", type="paper", title=" ".join(e.findtext("a:title", "", ns).split()),
                text=" ".join(e.findtext("a:summary", "", ns).split())[:4000],
                authors_or_owner=", ".join(a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)[:5]),
                year=year, venue_or_language="arXiv", url=f"https://arxiv.org/abs/{aid}",
                tags=[c.get("term") for c in e.findall("a:category", ns)][:5], meta={"open_access": True, "kind": "preprint"},
                source="arxiv", fetched_at=NOW()))
        return out, _status("arXiv", True, len(out))
    except Exception as e:
        return [], _status("arXiv", False, error=f"{type(e).__name__}: {str(e)[:120]}")


# ------------------------------------------------------------------ patents
def patent_search_links(queries: list[str]) -> list[dict]:
    """Deep links to official/public patent search engines for the generated queries (links, not results)."""
    out = []
    for q in queries[:4]:
        enc = urllib.parse.quote_plus(q)
        out.append({"query": q, "links": [
            {"name": "Google Patents", "url": f"https://patents.google.com/?q={urllib.parse.quote(q)}"},
            {"name": "Lens.org", "url": f"https://www.lens.org/lens/search/patent/list?q={enc}"},
            {"name": "Espacenet", "url": f"https://worldwide.espacenet.com/patent/search?q={enc}"},
            {"name": "WIPO PATENTSCOPE", "url": f"https://patentscope.wipo.int/search/en/result.jsf?query={enc}"},
        ]})
    return out


async def patentsview(query: str, limit: int = 15) -> tuple[list[Item], dict]:
    key = os.getenv("PATENTSVIEW_API_KEY", "")
    if not key:
        return [], _status("PatentsView", False, note="Set PATENTSVIEW_API_KEY (free at patentsview.org) for live US patent results. "
                                                     "Search links to Google Patents, Lens, Espacenet and WIPO are shown instead.")
    body = {"q": {"_text_any": {"patent_abstract": query}},
            "f": ["patent_id", "patent_title", "patent_abstract", "patent_date", "assignees.assignee_organization",
                  "inventors.inventor_name_last"], "o": {"size": limit}, "s": [{"patent_date": "desc"}]}
    try:
        async with httpx.AsyncClient(timeout=25, headers={**UA, "X-Api-Key": key}) as c:
            r = await c.post("https://search.patentsview.org/api/v1/patent/", json=body)
            r.raise_for_status()
        out = []
        for p in r.json().get("patents", []):
            pid = p.get("patent_id")
            assg = ", ".join(a.get("assignee_organization") or "" for a in (p.get("assignees") or [])[:2]).strip(", ")
            out.append(Item(id=f"patent:US{pid}", type="paper", title=p.get("patent_title") or "", text=(p.get("patent_abstract") or "")[:4000],
                            authors_or_owner=assg or ", ".join(i.get("inventor_name_last") or "" for i in (p.get("inventors") or [])[:3]),
                            year=int((p.get("patent_date") or "0")[:4] or 0) or None, venue_or_language="US patent",
                            url=f"https://patents.google.com/patent/US{pid}", meta={"patent": True, "patent_id": pid, "date": p.get("patent_date")},
                            source="patentsview", fetched_at=NOW()))
        return out, _status("PatentsView", True, len(out))
    except Exception as e:
        return [], _status("PatentsView", False, error=f"{type(e).__name__}: {str(e)[:120]}")


# ------------------------------------------------------------------ GitHub
def _gh_headers() -> dict:
    h = {**UA, "Accept": "application/vnd.github+json"}
    if os.getenv("GITHUB_TOKEN"):
        h["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    return h


def clean_markdown(md: str) -> str:
    md = re.sub(r"<!--.*?-->", " ", md, flags=re.S)
    md = re.sub(r"```.*?```", " ", md, flags=re.S)
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"<[^>]+>", " ", md)
    md = re.sub(r"^#+\s*", "", md, flags=re.M)
    md = re.sub(r"[*_`>|]+", " ", md)
    md = re.sub(r"[ \t]+", " ", md)
    return re.sub(r"\n\s*\n+", "\n", md).strip()


async def github_repos(query: str, limit: int = 15) -> tuple[list[Item], dict]:
    words = [w for w in re.findall(r"[A-Za-z0-9+#-]+", query) if len(w) > 2][:7]
    q = " ".join(words) + " in:name,description,readme,topics"
    try:
        async with httpx.AsyncClient(timeout=20, headers=_gh_headers()) as c:
            r = await c.get("https://api.github.com/search/repositories", params={"q": q, "sort": "best-match", "per_page": limit})
            if r.status_code != 200:
                raise RuntimeError(f"GitHub search returned {r.status_code}: {r.text[:100]}")
            repos = r.json().get("items", [])
            sem = asyncio.Semaphore(6)

            async def readme(full: str) -> str:
                async with sem:
                    rr = await c.get(f"https://api.github.com/repos/{full}/readme")
                if rr.status_code != 200:
                    return ""
                try:
                    return base64.b64decode(rr.json()["content"]).decode("utf-8", "ignore")
                except Exception:
                    return ""

            readmes = await asyncio.gather(*(readme(x["full_name"]) for x in repos))
        out = []
        for repo, md in zip(repos, readmes):
            desc = repo.get("description") or ""
            out.append(Item(
                id=f"proj:{repo['full_name']}", type="project", title=repo["name"].replace("-", " ").replace("_", " "),
                text=(desc + "\n" + clean_markdown(md))[:4000].strip() or desc, authors_or_owner=repo["owner"]["login"],
                year=int((repo.get("created_at") or "0")[:4] or 0) or None, venue_or_language=repo.get("language") or "",
                url=repo["html_url"], tags=(repo.get("topics") or [])[:8],
                meta={"full_name": repo["full_name"], "description": desc, "stars": repo.get("stargazers_count", 0),
                      "forks": repo.get("forks_count", 0), "pushed_at": repo.get("pushed_at"), "archived": repo.get("archived"),
                      "license": (repo.get("license") or {}).get("spdx_id"), "open_issues": repo.get("open_issues_count")},
                source="github", fetched_at=NOW()))
        return out, _status("GitHub", True, len(out))
    except Exception as e:
        return [], _status("GitHub", False, error=f"{type(e).__name__}: {str(e)[:140]}")
