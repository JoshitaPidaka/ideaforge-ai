"""Bounded collections: the seed collection plus user-uploaded ones (CSV / JSON / JSONL / BibTeX)."""
from __future__ import annotations

import csv
import io
import json
import re
from collections import Counter
from pathlib import Path

from .config import settings
from .retrieval import CollectionIndex
from .schemas import Item

_indexes: dict[str, CollectionIndex] = {}


def _path(name: str) -> Path:
    return settings.collection_dir / f"{name}.jsonl"


def list_collections() -> list[dict]:
    out = []
    for p in sorted(settings.collection_dir.glob("*.jsonl")):
        if p.stem.startswith("project-"):
            continue  # per-project bounded collections are internal to the workspace
        n = sum(1 for line in p.open(encoding="utf-8") if line.strip())
        out.append({"name": p.stem, "items": n, "custom": p.stem != "seed"})
    return out


def load_items(name: str) -> list[Item]:
    p = _path(name)
    if not p.exists():
        raise KeyError(name)
    return [Item.model_validate(json.loads(line)) for line in p.open(encoding="utf-8") if line.strip()]


def get_index(name: str) -> CollectionIndex:
    if name not in _indexes:
        _indexes[name] = CollectionIndex(load_items(name))
    return _indexes[name]


def stats(name: str) -> dict:
    items = get_index(name).items
    by_type = Counter(i.type for i in items)
    by_source = Counter(i.source for i in items)
    years = Counter(i.year for i in items if i.year)
    tags = Counter(t.lower() for i in items for t in i.tags)
    langs = Counter(i.venue_or_language for i in items if i.type == "project" and i.venue_or_language)
    return {
        "name": name, "total": len(items), "by_type": dict(by_type), "by_source": dict(by_source),
        "years": [{"year": y, "count": c} for y, c in sorted(years.items())],
        "top_tags": [{"tag": t, "count": c} for t, c in tags.most_common(20)],
        "languages": [{"language": t, "count": c} for t, c in langs.most_common(10)],
        "embedder": get_index(name).embedder.name,
    }


# ------------------------------------------------------------------ uploads
def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "custom"


def _from_row(row: dict, n: int, default_type: str) -> Item | None:
    g = lambda *keys: next((str(row[k]).strip() for k in keys if row.get(k) not in (None, "")), "")
    title = g("title", "Title", "name", "Name", "project", "Project")
    text = g("abstract", "Abstract", "description", "Description", "text", "summary", "Summary", "readme")
    if not title or len(text) < 30:
        return None
    typ = g("type", "Type").lower()
    typ = typ if typ in ("paper", "project") else default_type
    year = g("year", "Year")
    tags = g("tags", "keywords", "Keywords")
    return Item(id=f"{'paper' if typ == 'paper' else 'proj'}:custom:{n}:{_slug(title)}", type=typ, title=title,
                text=text[:4000], authors_or_owner=g("authors", "author", "Authors", "team", "owner"),
                year=int(year[:4]) if year[:4].isdigit() else None,
                venue_or_language=g("venue", "journal", "language", "booktitle"),
                url=g("url", "URL", "link", "doi", "DOI"),
                tags=[t.strip() for t in re.split(r"[;,|]", tags) if t.strip()][:8], source="user_upload")


def parse_bibtex(text: str) -> list[dict]:
    rows = []
    for entry in re.split(r"\n\s*@", "\n" + text):
        if "{" not in entry:
            continue
        fields = {k.lower(): re.sub(r"[{}\s]+", " ", v).strip()
                  for k, v in re.findall(r"(\w+)\s*=\s*[{\"](.+?)[}\"]\s*,?\s*(?=\n\s*\w+\s*=|\n?\s*}\s*$)", entry, re.S)}
        if fields:
            fields["type"] = "paper"
            rows.append(fields)
    return rows


def add_collection(name: str, filename: str, content: bytes, default_type: str = "project") -> dict:
    text = content.decode("utf-8", "ignore")
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        rows = list(csv.DictReader(io.StringIO(text)))
    elif ext == ".jsonl":
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    elif ext == ".json":
        data = json.loads(text)
        rows = data if isinstance(data, list) else data.get("items", [])
    elif ext in (".bib", ".bibtex"):
        rows = parse_bibtex(text)
    else:
        raise ValueError("Upload a .csv, .json, .jsonl or .bib file")
    items = [it for n, r in enumerate(rows) if (it := _from_row(r, n, default_type))]
    if len(items) < 3:
        raise ValueError("Need at least 3 rows with a title and a description/abstract (≥30 characters)")
    slug = _slug(name)
    if slug == "seed":
        slug = "seed-custom"
    with _path(slug).open("w", encoding="utf-8") as f:
        for it in items:
            f.write(it.model_dump_json() + "\n")
    _indexes.pop(slug, None)
    return {"name": slug, "items": len(items), "skipped": len(rows) - len(items)}
