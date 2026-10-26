"""IdeaForge AI: FastAPI application."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import collection, export, pipeline, prompts, store
from .config import ROOT, settings
from .gemma import GemmaUnavailable, gemma
from .grounding import verify_quote
from .parse import ParseError, parse_file
from .schemas import ProposalBrief, ReviewState

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = FastAPI(title="IdeaForge AI", version="1.0.0",
              description="Project Report Novelty & Prior-Art Explorer: semantic retrieval, structured comparison and "
                          "evidence-grounded summaries over a bounded collection, powered by Gemma 4.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])

SAMPLES = ROOT / "data" / "samples"

from .api_v2 import r as workspace_router  # noqa: E402

app.include_router(workspace_router)


def err(status: int, code: str, message: str, hint: str = "") -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "hint": hint}})


@app.exception_handler(GemmaUnavailable)
async def _gemma_down(_: Request, e: GemmaUnavailable):
    return err(503, "ai_unavailable", str(e), "Set GEMINI_API_KEY (and optionally GEMMA_MODEL) and restart the backend.")


@app.exception_handler(ParseError)
async def _parse_err(_: Request, e: ParseError):
    return err(400, "bad_file", str(e))


# ------------------------------------------------------------------ health & collections
@app.get("/api/health")
def health():
    cols = collection.list_collections()
    return {"ok": True, "ai": {"available": gemma.available, "model": gemma.model, "error": gemma.error},
            "collections": cols, "embedder_setting": settings.embedder}


@app.get("/api/collections")
def collections():
    return collection.list_collections()


@app.get("/api/collections/{name}")
def collection_stats(name: str):
    try:
        return collection.stats(name)
    except KeyError:
        raise HTTPException(404, f"No collection named {name}")


@app.get("/api/collections/{name}/items")
def collection_items(name: str, q: str = "", type: str = "", offset: int = 0, limit: int = 30):
    try:
        idx = collection.get_index(name)
    except KeyError:
        raise HTTPException(404, f"No collection named {name}")
    items = idx.items
    if q.strip():
        hits = idx.search(q, k=100)
        items = [idx.items[h.idx] for h in hits]
    if type:
        items = [i for i in items if i.type == type]
    done = store.summarized_ids()
    page = [{**i.model_dump(exclude={"text"}), "snippet": i.text[:280], "has_summary": i.id in done}
            for i in items[offset: offset + limit]]
    return {"total": len(items), "items": page}


@app.get("/api/items/{item_id:path}/summary")
def get_item_summary(item_id: str):
    return store.get_summary(item_id) or {}


@app.post("/api/items/{item_id:path}/summary")
async def item_summary(item_id: str, collection_name: str = "seed"):
    """AI summary card for a paper or GitHub project (Gemma 4), with verified evidence quotes. Cached."""
    idx = collection.get_index(collection_name)
    item = next((i for i in idx.items if i.id == item_id), None)
    if not item:
        raise HTTPException(404, "Item not found in this collection")
    return await pipeline.summarize_item(item)


@app.get("/api/items/{item_id:path}")
def get_item(item_id: str, collection_name: str = "seed"):
    idx = collection.get_index(collection_name)
    item = next((i for i in idx.items if i.id == item_id), None)
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@app.post("/api/collections/upload")
async def upload_collection(name: str = Form(...), default_type: str = Form("project"), file: UploadFile = File(...)):
    try:
        return collection.add_collection(name, file.filename or "upload.csv", await file.read(), default_type)
    except ValueError as e:
        return err(400, "bad_collection", str(e), "Columns needed: title + abstract/description; optional: type, year, url, authors, tags")


# ------------------------------------------------------------------ proposals
@app.get("/api/samples")
def samples():
    out = []
    for p in sorted(SAMPLES.glob("*.md")):
        lines = p.read_text().splitlines()
        body = " ".join(" ".join(lines[1:]).split()[:40])
        out.append({"id": p.stem, "title": lines[0].lstrip("# ").strip(), "preview": body + "…"})
    return out


@app.post("/api/proposals")
async def create_proposal(file: UploadFile | None = File(None), text: str = Form(""), sample: str = Form("")):
    pid = uuid.uuid4().hex[:12]
    images: list[bytes] = []
    if sample:
        p = SAMPLES / f"{Path(sample).name}.md"
        if not p.exists():
            raise HTTPException(404, "Unknown sample")
        name, body = p.name, p.read_text()
    elif file is not None:
        name = file.filename or "proposal"
        body, images = parse_file(name, await file.read())
    else:
        name, body = "pasted text", text
    if len(body.strip()) < 80:
        return err(400, "too_short", "The proposal text is too short to analyse.", "Paste at least a paragraph describing the project.")
    store.save_proposal(pid, name, body, len(images))
    fd = pipeline.figures_dir(pid)
    fd.mkdir(parents=True, exist_ok=True)
    for i, img in enumerate(images, 1):
        (fd / f"fig_{i}.png").write_bytes(img)
    return {"id": pid, "name": name, "chars": len(body), "figures": [f"/api/proposals/{pid}/figures/{i}" for i in range(1, len(images) + 1)],
            "preview": body[:1500]}


@app.get("/api/proposals/{pid}/figures/{n}")
def figure(pid: str, n: int):
    p = pipeline.figures_dir(Path(pid).name) / f"fig_{int(n)}.png"
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, media_type="image/png")


@app.post("/api/proposals/{pid}/brief")
async def make_brief(pid: str):
    try:
        brief = await pipeline.extract_brief(pid)
    except KeyError:
        raise HTTPException(404, "Proposal not found")
    return brief


@app.put("/api/proposals/{pid}/brief")
def update_brief(pid: str, brief: ProposalBrief):
    if not store.get_proposal(pid):
        raise HTTPException(404, "Proposal not found")
    store.save_brief(pid, brief.model_dump())
    return brief


# ------------------------------------------------------------------ analyses
class StartAnalysis(BaseModel):
    proposal_id: str
    collection: str = "seed"
    brief: ProposalBrief | None = None


@app.post("/api/analyses")
async def start(body: StartAnalysis):
    prop = store.get_proposal(body.proposal_id)
    if not prop:
        raise HTTPException(404, "Proposal not found")
    brief = body.brief or (ProposalBrief(**prop["brief"]) if prop["brief"] else await pipeline.extract_brief(body.proposal_id))
    if not brief.contributions:
        return err(400, "no_contributions", "Add at least one contribution to the brief before searching.")
    if body.brief:
        store.save_brief(body.proposal_id, brief.model_dump())
    if body.collection not in {c["name"] for c in collection.list_collections()}:
        raise HTTPException(404, "Unknown collection")
    aid = await pipeline.start_analysis(body.proposal_id, body.collection, brief)
    return {"id": aid}


@app.get("/api/analyses")
def recent():
    return store.list_analyses()


@app.get("/api/analyses/{aid}")
def analysis(aid: str):
    r = pipeline.get_result(aid)
    if not r:
        raise HTTPException(404, "Analysis not found")
    return r


@app.get("/api/analyses/{aid}/events")
async def events(aid: str, request: Request):
    async def gen():
        sent = 0
        while True:
            evs = pipeline.EVENTS.get(aid, [])
            for e in evs[sent:]:
                yield f"data: {json.dumps(e)}\n\n"
            sent = len(evs)
            if (evs and evs[-1]["stage"] in ("done", "error")) or (not evs and store.get_analysis(aid)):
                if not evs:
                    yield f"data: {json.dumps({'stage': 'done', 'message': 'Analysis complete', 'progress': 1})}\n\n"
                break
            if await request.is_disconnected():
                break
            await asyncio.sleep(0.35)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class Review(BaseModel):
    state: ReviewState
    note: str = ""


@app.patch("/api/analyses/{aid}/leads/{lead_id:path}")
def review(aid: str, lead_id: str, body: Review):
    if not store.get_analysis(aid):
        raise HTTPException(404, "Analysis not found (wait until it finishes)")
    store.set_review(aid, lead_id, body.state, body.note)
    return {"ok": True}


class Ask(BaseModel):
    question: str


@app.post("/api/analyses/{aid}/ask")
async def ask(aid: str, body: Ask):
    """Chat with the evidence: answers grounded only in this analysis' leads, with verified quotes."""
    r = pipeline.get_result(aid)
    if not r:
        raise HTTPException(404, "Analysis not found")

    class Cit(BaseModel):
        lead_id: str
        quote: str = ""

    class Answer(BaseModel):
        answer: str
        citations: list[Cit] = []
        confidence: str = "medium"

    leads = r["leads"]
    a = await gemma.json(prompts.ask_evidence(body.question[:600], pipeline.brief_for_prompt(ProposalBrief(**r["brief"])),
                                              pipeline.leads_block(leads, chars=1200)), Answer)
    texts = {l["item"]["id"]: l["item"] for l in leads}
    cits = [{"lead_id": c.lead_id, "title": texts[c.lead_id]["title"], "url": texts[c.lead_id]["url"], "quote": c.quote,
             "verified": bool(c.quote) and verify_quote(c.quote, texts[c.lead_id]["text"])}
            for c in a.citations if c.lead_id in texts]
    return {"answer": a.answer, "citations": cits, "confidence": a.confidence}


@app.post("/api/analyses/{aid}/related-work")
async def related_work(aid: str):
    r = store.get_analysis(aid)
    if not r:
        raise HTTPException(404, "Analysis not found")
    chosen = [l for l in r["leads"] if l.get("review") == "relevant"]
    used_all = not chosen
    chosen = chosen or r["leads"][:6]

    class RW(BaseModel):
        markdown: str

    out = await gemma.json(prompts.related_work(pipeline.brief_for_prompt(ProposalBrief(**r["brief"])),
                                                pipeline.leads_block(chosen, numbered=True, chars=1000)), RW, temperature=0.4)
    refs = "\n".join(f"[{n}] {l['item']['authors_or_owner']}. *{l['item']['title']}*. {l['item'].get('year') or ''}. {l['item']['url']}"
                     for n, l in enumerate(chosen, 1))
    return {"markdown": out.markdown + "\n\n**References**\n\n" + refs, "used_unreviewed": used_all, "count": len(chosen)}


@app.get("/api/analyses/{aid}/export")
def export_analysis(aid: str, format: str = "md", reviewed_only: bool = True):
    r = store.get_analysis(aid)
    if not r:
        raise HTTPException(404, "Analysis not found")
    slug = "".join(c if c.isalnum() else "-" for c in (r["brief"].get("title") or "report"))[:40].strip("-").lower()
    if format == "json":
        return JSONResponse(r, headers={"Content-Disposition": f'attachment; filename="ideaforge-{slug}.json"'})
    if format == "bibtex":
        return PlainTextResponse(export.bibtex(r, reviewed_only), headers={"Content-Disposition": f'attachment; filename="ideaforge-{slug}.bib"'})
    if format == "html":
        return HTMLResponse(export.html_report(r, reviewed_only))
    return PlainTextResponse(export.markdown(r, reviewed_only), media_type="text/markdown",
                             headers={"Content-Disposition": f'attachment; filename="ideaforge-{slug}.md"'})


# ------------------------------------------------------------------ batch mode
@app.post("/api/batch-compare")
async def batch_compare(files: list[UploadFile] = File(...), collection_name: str = Form("seed")):
    """Compare several proposals with each other (duplicate-topic detection for a class or hackathon)."""
    if not 2 <= len(files) <= 30:
        return err(400, "bad_batch", "Upload between 2 and 30 proposals.")
    names, texts = [], []
    for f in files:
        body, _ = parse_file(f.filename or "p.txt", await f.read())
        names.append(f.filename or f"proposal {len(names) + 1}")
        texts.append(body[:8000])
    idx = collection.get_index(collection_name)
    V = idx.embed(texts)
    S = (V @ V.T).clip(-1, 1)
    pairs = sorted(({"a": names[i], "b": names[j], "similarity": round(float(S[i, j]), 3)}
                    for i in range(len(names)) for j in range(i + 1, len(names))), key=lambda p: -p["similarity"])
    nearest = []
    for i, t in enumerate(texts):
        hits = idx.search(t, k=20)[:3]
        nearest.append({"proposal": names[i], "leads": [{"id": idx.items[h.idx].id, "title": idx.items[h.idx].title,
                                                         "url": idx.items[h.idx].url} for h in hits]})
    return {"names": names, "matrix": np.round(S, 3).tolist(), "pairs": pairs, "nearest": nearest,
            "embedder": idx.embedder.name}


# ------------------------------------------------------------------ serve built frontend (production)
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").exists():
    @app.get("/", include_in_schema=False)
    def no_frontend():
        return HTMLResponse("<body style='font:16px system-ui;background:#070B18;color:#e2e8f0;padding:40px'>"
                            "<h2>IdeaForge AI backend is running ✅</h2><p>But the website files (<code>frontend/dist</code>) are missing.</p>"
                            "<p>Download the latest <b>ideaforge-ai.zip</b> (it includes the prebuilt website), or install Node.js and run "
                            "<code>npm install</code> then <code>npm run build</code> inside the <code>frontend</code> folder.</p>"
                            "<p>API status: <a style='color:#818cf8' href='/api/health'>/api/health</a></p></body>")
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
