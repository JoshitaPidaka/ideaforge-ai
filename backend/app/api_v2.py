"""Workspace API: projects and the five modules (research, GitHub, architect, onboarding, evaluation) + novelty."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from . import evaluation, onboarding, pipeline, store, workspace
from .gemma import gemma
from .parse import parse_file
from .schemas import ProposalBrief

r = APIRouter(prefix="/api")


def _p(pid: str) -> dict:
    p = workspace.project(pid)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


# ------------------------------------------------------------------ projects
@r.post("/projects")
async def create(idea: str = Form(""), name: str = Form(""), file: UploadFile | None = File(None), sample: str = Form("")):
    images: list[bytes] = []
    if sample:
        from .main import SAMPLES

        p = SAMPLES / f"{sample.rsplit('/', 1)[-1]}.md"
        if not p.exists():
            raise HTTPException(404, "Unknown sample")
        idea = p.read_text()
    elif file is not None:
        idea, images = parse_file(file.filename or "idea.txt", await file.read())
        name = name or (file.filename or "").rsplit(".", 1)[0]
    if len(idea.strip()) < 20:
        raise HTTPException(400, "Describe your idea in at least a sentence or two.")
    return await workspace.create_project(idea.strip(), name.strip(), images or None)


@r.get("/projects")
def projects():
    return workspace.list_projects()


@r.get("/projects/{pid}")
def get_project(pid: str):
    return _p(pid)


@r.put("/projects/{pid}/brief")
def put_brief(pid: str, brief: ProposalBrief):
    _p(pid)
    workspace.save_brief(pid, brief)
    return workspace.project(pid)


@r.get("/projects/{pid}/evidence")
def get_evidence(pid: str, module: str = ""):
    _p(pid)
    return workspace.evidence(pid, module or None)


class Saved(BaseModel):
    item_id: str
    saved: bool


@r.post("/projects/{pid}/evidence/save")
def save_evidence(pid: str, body: Saved):
    workspace.set_saved(pid, body.item_id, body.saved)
    return {"ok": True}


@r.get("/projects/{pid}/artifacts/{kind}")
def get_artifact(pid: str, kind: str):
    _p(pid)
    return workspace.artifact(pid, kind) or {}


@r.post("/projects/{pid}/items/summary")
async def item_summary(pid: str, body: Saved):
    item = workspace.get_item(pid, body.item_id)
    if not item:
        raise HTTPException(404, "Item not in this project")
    return await pipeline.summarize_item(item)


# ------------------------------------------------------------------ module 1: research
class Search(BaseModel):
    queries: list[str] = []
    year_from: int | None = None
    include_patents: bool = True


@r.post("/projects/{pid}/research/search")
async def research(pid: str, body: Search):
    _p(pid)
    run = await workspace.research_search(pid, body.queries or None, body.year_from, body.include_patents)
    return {**run, "results": workspace.evidence(pid, "research")}


@r.post("/projects/{pid}/research/gaps")
async def gaps(pid: str):
    _p(pid)
    return await workspace.research_gaps(pid)


class Ids(BaseModel):
    ids: list[str]


@r.post("/projects/{pid}/compare")
async def compare(pid: str, body: Ids):
    _p(pid)
    if not 2 <= len(body.ids) <= 5:
        raise HTTPException(400, "Select 2 to 5 items to compare.")
    return await workspace.compare(pid, body.ids)


# ------------------------------------------------------------------ module 2: GitHub
@r.post("/projects/{pid}/github/search")
async def github(pid: str, body: Search):
    _p(pid)
    run = await workspace.github_search(pid, body.queries or None)
    return {**run, "results": workspace.evidence(pid, "github")}


@r.post("/projects/{pid}/github/build-plan")
async def build_plan(pid: str):
    _p(pid)
    return await workspace.build_plan(pid)


# ------------------------------------------------------------------ module 3: architect
class Arch(BaseModel):
    constraints: str = ""
    section: str = ""
    instruction: str = ""


@r.post("/projects/{pid}/architect")
async def architect(pid: str, body: Arch):
    _p(pid)
    return await workspace.architect(pid, body.constraints, body.section, body.instruction)


# ------------------------------------------------------------------ novelty (problem statement core)
@r.post("/projects/{pid}/novelty")
async def novelty(pid: str):
    p = _p(pid)
    if not p["brief"] or not p["brief"].get("contributions"):
        raise HTTPException(400, "The brief has no contributions yet.")
    name = workspace.build_project_collection(pid)
    aid = await pipeline.start_analysis(pid, name, ProposalBrief(**p["brief"]))
    workspace.set_novelty(pid, aid)
    return {"id": aid, "collection": name}


# ------------------------------------------------------------------ module 4: onboarding
class Scan(BaseModel):
    url: str
    project_id: str = ""


@r.post("/onboarding/scan")
async def scan(body: Scan):
    try:
        data = await onboarding.scan(body.url)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Could not inspect the repository: {e}")
    if body.project_id and workspace.project(body.project_id):
        workspace._art_set(body.project_id, "onboarding_scan", data["id"])
    return data


@r.get("/onboarding/scans")
def scans():
    return onboarding.list_scans()


@r.get("/onboarding/{sid}")
def get_scan(sid: str):
    d = onboarding.get_scan(sid)
    if not d:
        raise HTTPException(404, "Scan not found")
    return d


@r.get("/onboarding/{sid}/file")
def file(sid: str, path: str):
    return onboarding.read_file(sid, path)


class Ask(BaseModel):
    question: str


@r.post("/onboarding/{sid}/ask")
async def ask(sid: str, body: Ask):
    try:
        return await onboarding.ask(sid, body.question[:600])
    except KeyError:
        raise HTTPException(404, "Scan the repository first")


# ------------------------------------------------------------------ module 5: evaluation
class Gen(BaseModel):
    scan_id: str
    n: int = 6


@r.post("/eval/sets")
async def gen_set(body: Gen):
    try:
        return await evaluation.generate_set(body.scan_id, max(3, min(body.n, 12)))
    except KeyError:
        raise HTTPException(404, "Scan the repository first")


@r.get("/eval/sets/{set_id}")
def get_set(set_id: str):
    s = evaluation.get_set(set_id)
    if not s:
        raise HTTPException(404)
    return s


class SetQs(BaseModel):
    questions: list[dict]


@r.put("/eval/sets/{set_id}")
def put_set(set_id: str, body: SetQs):
    evaluation.save_set(set_id, body.questions)
    return evaluation.get_set(set_id)


class Run(BaseModel):
    set_id: str
    top_k: int = 8
    retriever: str = "hybrid"
    label: str = ""


@r.post("/eval/runs")
async def run(body: Run):
    if body.retriever not in ("hybrid", "dense", "bm25"):
        raise HTTPException(400, "retriever must be hybrid, dense or bm25")
    return await evaluation.run(body.set_id, max(2, min(body.top_k, 15)), body.retriever, body.label)


@r.get("/eval/runs")
def runs(set_id: str = ""):
    return evaluation.list_runs(set_id or None)


@r.get("/eval/runs/{rid}")
def get_run(rid: str):
    x = evaluation.get_run(rid)
    if not x:
        raise HTTPException(404)
    return x


@r.get("/system")
def system():
    return {"model": gemma.model, "ai": gemma.available, "fallbacks": gemma.fallbacks}
