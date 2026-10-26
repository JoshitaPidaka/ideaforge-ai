"""Tiny SQLite store: proposals, analyses, lead reviews, AI summaries and the Gemma response cache."""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone

from .config import settings

_lock = threading.Lock()
settings.data_dir.mkdir(parents=True, exist_ok=True)
_conn = sqlite3.connect(settings.db_path, check_same_thread=False)
_conn.executescript("""
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, name TEXT, text TEXT, n_images INT, brief TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, proposal_id TEXT, result TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS reviews (analysis_id TEXT, lead_id TEXT, state TEXT, note TEXT, PRIMARY KEY (analysis_id, lead_id));
CREATE TABLE IF NOT EXISTS summaries (item_id TEXT PRIMARY KEY, summary TEXT, model TEXT, created_at TEXT);
""")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _q(sql: str, args: tuple = ()) -> list[tuple]:
    with _lock:
        cur = _conn.execute(sql, args)
        rows = cur.fetchall()
        _conn.commit()
        return rows


def cache_get(key: str) -> str | None:
    rows = _q("SELECT value FROM cache WHERE key=?", (key,))
    return rows[0][0] if rows else None


def cache_set(key: str, value: str) -> None:
    _q("INSERT OR REPLACE INTO cache VALUES (?,?)", (key, value))


def save_proposal(pid: str, name: str, text: str, n_images: int) -> None:
    _q("INSERT OR REPLACE INTO proposals VALUES (?,?,?,?,?,?)", (pid, name, text, n_images, None, now()))


def get_proposal(pid: str) -> dict | None:
    rows = _q("SELECT id,name,text,n_images,brief,created_at FROM proposals WHERE id=?", (pid,))
    if not rows:
        return None
    r = rows[0]
    return {"id": r[0], "name": r[1], "text": r[2], "n_images": r[3],
            "brief": json.loads(r[4]) if r[4] else None, "created_at": r[5]}


def save_brief(pid: str, brief: dict) -> None:
    _q("UPDATE proposals SET brief=? WHERE id=?", (json.dumps(brief), pid))


def save_analysis(aid: str, pid: str, result: dict) -> None:
    _q("INSERT OR REPLACE INTO analyses VALUES (?,?,?,?)", (aid, pid, json.dumps(result), result.get("created_at") or now()))


def get_analysis(aid: str) -> dict | None:
    rows = _q("SELECT result FROM analyses WHERE id=?", (aid,))
    if not rows:
        return None
    result = json.loads(rows[0][0])
    reviews = {r[0]: (r[1], r[2]) for r in _q("SELECT lead_id,state,note FROM reviews WHERE analysis_id=?", (aid,))}
    for lead in result.get("leads", []):
        if lead["item"]["id"] in reviews:
            lead["review"], lead["note"] = reviews[lead["item"]["id"]]
    return result


def list_analyses(limit: int = 20) -> list[dict]:
    rows = _q("SELECT id, result, created_at FROM analyses ORDER BY created_at DESC LIMIT ?", (limit,))
    out = []
    for aid, res, created in rows:
        r = json.loads(res)
        out.append({"id": aid, "title": r.get("brief", {}).get("title") or "Untitled proposal",
                    "status": r.get("status"), "leads": len(r.get("leads", [])),
                    "overlap": ((r.get("insight") or {}).get("overlap") or {}).get("level"), "created_at": created})
    return out


def set_review(aid: str, lead_id: str, state: str, note: str) -> None:
    _q("INSERT OR REPLACE INTO reviews VALUES (?,?,?,?)", (aid, lead_id, state, note))


def get_summary(item_id: str) -> dict | None:
    rows = _q("SELECT summary, model, created_at FROM summaries WHERE item_id=?", (item_id,))
    return {"summary": json.loads(rows[0][0]), "model": rows[0][1], "created_at": rows[0][2]} if rows else None


def save_summary(item_id: str, summary: dict, model: str) -> None:
    _q("INSERT OR REPLACE INTO summaries VALUES (?,?,?,?)", (item_id, json.dumps(summary), model, now()))


def summarized_ids() -> set[str]:
    return {r[0] for r in _q("SELECT item_id FROM summaries")}
