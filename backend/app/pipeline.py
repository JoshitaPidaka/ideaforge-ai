"""The IdeaForge pipeline: A) understand proposal → B) hybrid retrieval → C) structured comparison with
verified evidence → D) deterministic indicators + Gemma synthesis."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import Counter

import numpy as np

from . import collection, prompts, store
from .config import settings
from .gemma import GemmaUnavailable, gemma
from .grounding import verify_quote
from .parse import heuristic_brief
from .retrieval import project_2d
from .schemas import (AnalysisResult, ContributionInsight, Gap, Idea, Indicator, JudgeQuestion, Lead, NoveltyInsight,
                      OverlapReport, ProposalBrief)

log = logging.getLogger("ideaforge.pipeline")

RUNNING: dict[str, AnalysisResult] = {}
EVENTS: dict[str, list[dict]] = {}


def emit(aid: str, stage: str, message: str, progress: float) -> None:
    EVENTS.setdefault(aid, []).append({"stage": stage, "message": message, "progress": round(progress, 3), "t": time.time()})


def figures_dir(pid: str):
    return settings.data_dir / "uploads" / pid


# ------------------------------------------------------------------ Step A
async def extract_brief(pid: str) -> ProposalBrief:
    prop = store.get_proposal(pid)
    if not prop:
        raise KeyError(pid)
    images = [p.read_bytes() for p in sorted(figures_dir(pid).glob("fig_*.png"))]
    if gemma.available:
        try:
            brief = await gemma.json(prompts.brief_extraction(prop["text"], len(images)), ProposalBrief, images or None)
            brief.generated_by = "gemma"
            brief.contributions = [c for c in brief.contributions if c.strip()][:7]
        except Exception as e:
            log.warning("Gemma brief failed, using heuristic: %s", e)
            brief = heuristic_brief(prop["text"])
    else:
        brief = heuristic_brief(prop["text"])
    store.save_brief(pid, brief.model_dump())
    return brief


def brief_query(b: ProposalBrief) -> str:
    return " ".join([b.title, b.problem, b.method, b.platform, b.target_users, " ".join(b.keywords),
                     " ".join(b.contributions)]).replace("not stated", "")


def brief_for_prompt(b: ProposalBrief) -> str:
    d = b.model_dump(exclude={"figure_insights", "generated_by"})
    d["contributions"] = {i: c for i, c in enumerate(b.contributions)}
    return json.dumps(d, ensure_ascii=False, indent=1)


# ------------------------------------------------------------------ Step C helpers
def verify_report(rep: OverlapReport, source_text: str, n_contrib: int) -> OverlapReport:
    for a in rep.aspects:
        a.verified = bool(a.evidence_quote) and verify_quote(a.evidence_quote, source_text)
    keep = []
    for m in rep.contribution_matches:
        if 0 <= m.contribution_index < n_contrib:
            m.verified = bool(m.evidence_quote) and verify_quote(m.evidence_quote, source_text)
            keep.append(m)
    rep.contribution_matches = keep
    return rep


# ------------------------------------------------------------------ Step D: deterministic indicators
LEVEL_VAL = {"high": 1.0, "medium": 0.5, "low": 0.0}


def contribution_scores(brief: ProposalBrief, leads: list[Lead]) -> list[ContributionInsight]:
    max_f = max((l.fused_score for l in leads), default=1.0) or 1.0
    out = []
    for ci, text in enumerate(brief.contributions):
        score, support = 0.0, []
        for l in leads:
            w = 0.5 + 0.5 * l.fused_score / max_f
            if l.report:
                for m in l.report.contribution_matches:
                    if m.contribution_index == ci and m.verified and m.relation != "does_not_cover":
                        score += w * (1.0 if m.relation == "covers" else 0.5)
                        support.append(l.item.id)
            elif ci in l.matched_contributions:  # retrieval-only estimate, scaled by semantic similarity
                sim_factor = min(1.0, max(0.0, (l.similarity - 0.12) / 0.3))
                if sim_factor > 0:
                    score += w * 0.35 * sim_factor
                    support.append(l.item.id)
        level = "high" if score >= 0.9 else "medium" if score >= 0.35 else "low"
        if not any(l.report for l in leads) and level == "high":
            level = "medium"  # never claim high overlap without verified evidence
        out.append(ContributionInsight(index=ci, contribution=text, overlap_level=level, score=round(score, 3),
                                       supporting_leads=list(dict.fromkeys(support))))
    return out


def indicators(contribs: list[ContributionInsight], leads: list[Lead], searched: int, by_type: Counter,
               ai: bool) -> tuple[Indicator, Indicator, Indicator]:
    ov = float(np.mean([min(c.score, 1.5) / 1.5 for c in contribs])) if contribs else 0.0
    n_high = sum(c.overlap_level == "high" for c in contribs)
    overlap = Indicator(label="Overlap", value=round(ov, 3), level="high" if ov >= 0.6 else "medium" if ov >= 0.3 else "low",
                        explanation=f"{n_high} of {len(contribs)} contributions have strong matching evidence in the collection."
                        + ("" if ai else " Estimated from retrieval only (AI comparison offline)."))

    has_p, has_r = by_type.get("paper", 0) > 0, by_type.get("project", 0) > 0
    cov = 0.5 * min(1.0, searched / 500) + 0.25 * has_p + 0.25 * has_r
    lead_types = Counter(l.item.type for l in leads)
    missing = [] if has_p and has_r else ["papers" if not has_p else "project descriptions"]
    cov_level = "high" if cov >= 0.75 and not missing else "medium" if cov >= 0.45 else "low"
    coverage = Indicator(label="Coverage", value=round(cov, 3), level=cov_level,
                         explanation=f"Searched {searched} items ({by_type.get('paper', 0)} papers, {by_type.get('project', 0)} projects) "
                         f"with {1 + len(contribs)} queries; leads: {lead_types.get('paper', 0)} papers, {lead_types.get('project', 0)} projects."
                         + (f" This collection has no {missing[0]}, so related work of that kind could be missed." if missing else ""))

    if ai:
        quotes = [x for l in leads if l.report for x in [*l.report.aspects, *l.report.contribution_matches] if x.evidence_quote]
        vr = sum(q.verified for q in quotes) / len(quotes) if quotes else 0.0
        rich = min(1.0, float(np.mean([len(l.item.text) for l in leads])) / 800) if leads else 0.0
        conf = 0.75 * vr + 0.25 * rich
        exp = f"{sum(q.verified for q in quotes)} of {len(quotes)} evidence quotes were verified word-for-word in the sources."
    else:
        conf, exp = 0.2, "Low: no AI comparison was run, so there are no verified quotes yet. Treat leads as unread."
    confidence = Indicator(label="Confidence", value=round(conf, 3), level="high" if conf >= 0.7 else "medium" if conf >= 0.45 else "low",
                           explanation=exp)
    return overlap, coverage, confidence


# ------------------------------------------------------------------ orchestrator
async def start_analysis(pid: str, collection_name: str, brief: ProposalBrief) -> str:
    aid = uuid.uuid4().hex[:12]
    res = AnalysisResult(id=aid, proposal_id=pid, collection=collection_name, status="running",
                         ai_mode="gemma" if gemma.available else "retrieval_only", model=gemma.model if gemma.available else "",
                         brief=brief, created_at=store.now())
    RUNNING[aid] = res
    emit(aid, "queued", "Analysis queued", 0.0)
    asyncio.create_task(_run(res))
    return aid


async def _run(res: AnalysisResult) -> None:
    aid, brief, t0 = res.id, res.brief, time.time()
    try:
        emit(aid, "retrieving", f"Loading collection “{res.collection}”…", 0.05)
        index = await asyncio.to_thread(collection.get_index, res.collection)
        res.embedder = index.embedder.name
        res.searched = len(index.items)
        emit(aid, "retrieving", f"Searching {len(index.items)} items with {1 + len(brief.contributions)} semantic queries…", 0.12)
        hits, main_sim = await asyncio.to_thread(index.multi_search, brief_query(brief), brief.contributions, settings.top_leads)
        res.leads = [Lead(item=index.items[h.idx], rank=r + 1, similarity=round(max(0.0, h.dense), 4),
                          fused_score=round(h.fused, 5), matched_contributions=sorted(h.queries)) for r, h in enumerate(hits)]
        res.timings["retrieval_s"] = round(time.time() - t0, 2)
        emit(aid, "retrieved", f"Found {len(res.leads)} leads", 0.3)

        # similarity map + timeline (cheap, no AI)
        top = np.argsort(-main_sim)[:60]
        lead_idx = {h.idx for h in hits}
        idxs = list(dict.fromkeys([h.idx for h in hits] + [int(i) for i in top]))
        V = np.vstack([index.embed([brief_query(brief)]), index.vectors[idxs]])
        P = project_2d(V)
        res.map_points = [{"id": "proposal", "x": float(P[0, 0]), "y": float(P[0, 1]), "kind": "proposal", "title": brief.title}] + [
            {"id": index.items[i].id, "x": float(P[k + 1, 0]), "y": float(P[k + 1, 1]), "kind": index.items[i].type,
             "lead": i in lead_idx, "title": index.items[i].title, "similarity": round(float(main_sim[i]), 3)}
            for k, i in enumerate(idxs)]
        yc: Counter = Counter()
        for i in top[:40]:
            it = index.items[int(i)]
            if it.year:
                yc[(it.year, it.type)] += 1
        years = sorted({y for y, _ in yc})
        res.timeline = [{"year": y, "paper": yc.get((y, "paper"), 0), "project": yc.get((y, "project"), 0)} for y in years]

        # Step C
        ai_ok = gemma.available
        if ai_ok:
            bj = brief_for_prompt(brief)
            done = 0

            async def compare(lead: Lead):
                nonlocal done
                try:
                    rep = await gemma.json(prompts.overlap_report(bj, lead.item.id, lead.item.type, lead.item.title, lead.item.text),
                                           OverlapReport)
                    rep.lead_id = lead.item.id
                    lead.report = verify_report(rep, lead.item.text, len(brief.contributions))
                except Exception as e:
                    log.warning("overlap report failed for %s: %s", lead.item.id, e)
                done += 1
                emit(aid, "comparing", f"Comparing with leads… {done}/{len(res.leads)}", 0.3 + 0.5 * done / len(res.leads))

            emit(aid, "comparing", f"Comparing with leads… 0/{len(res.leads)}", 0.3)
            await asyncio.gather(*(compare(l) for l in res.leads))
            ai_ok = any(l.report for l in res.leads)
            if not ai_ok:
                res.ai_mode = "retrieval_only"
        res.timings["compare_s"] = round(time.time() - t0, 2)

        # Step D
        emit(aid, "synthesizing", "Computing overlap, coverage and confidence…", 0.82)
        contribs = contribution_scores(brief, res.leads)
        by_type = Counter(i.type for i in index.items)
        ov, cov, conf = indicators(contribs, res.leads, len(index.items), by_type, ai_ok)
        insight = NoveltyInsight(overlap=ov, coverage=cov, confidence=conf, contributions=contribs)
        if ai_ok:
            emit(aid, "synthesizing", "Writing insights, gaps and ideas with Gemma…", 0.88)
            try:
                await _synthesize(insight, brief, res.leads)
            except Exception as e:
                log.warning("synthesis failed: %s", e)
        else:
            insight.headline = "Leads found by semantic search. Connect Gemma 4 to get explained overlap and verified evidence."
        res.insight = insight
        res.status = "done"
        res.timings["total_s"] = round(time.time() - t0, 2)
        emit(aid, "done", "Analysis complete", 1.0)
    except Exception as e:
        log.exception("analysis failed")
        res.status, res.error = "error", f"{type(e).__name__}: {e}"
        emit(aid, "error", res.error, 1.0)
    finally:
        store.save_analysis(aid, res.proposal_id, res.model_dump())
        RUNNING.pop(aid, None)


async def _synthesize(insight: NoveltyInsight, brief: ProposalBrief, leads: list[Lead]) -> None:
    contrib_block = "\n".join(f"#{c.index} [{c.overlap_level} overlap; supporting leads: {', '.join(c.supporting_leads) or 'none'}] "
                              f"{c.contribution}" for c in insight.contributions)
    lead_lines = []
    for l in leads:
        if not l.report:
            continue
        aspects = "; ".join(f"{a.aspect}={a.relation}" + (f" (\"{a.evidence_quote[:140]}\")" if a.verified else "")
                            for a in l.report.aspects)
        lead_lines.append(f"- {l.item.id} | {l.item.type} | {l.item.title} | overlap={l.report.overlap_level} | {aspects} "
                          f"| key difference: {l.report.key_difference}")
    from pydantic import BaseModel

    class _C(BaseModel):
        index: int
        explanation: str = ""
        simple: str = ""

    class _S(BaseModel):
        contributions: list[_C] = []
        headline: str = ""
        simple_summary: str = ""
        gaps: list[Gap] = []
        ideas: list[Idea] = []
        pitch_line: str = ""
        judge_questions: list[JudgeQuestion] = []

    out = await gemma.json(prompts.synthesis(brief_for_prompt(brief), contrib_block, "\n".join(lead_lines)), _S, temperature=0.5)
    valid = {l.item.id for l in leads}
    by_i = {c.index: c for c in out.contributions}
    for c in insight.contributions:
        if c.index in by_i:
            c.explanation, c.simple = by_i[c.index].explanation, by_i[c.index].simple
    for g in out.gaps:
        g.checked_leads = [x for x in g.checked_leads if x in valid]
    for q in out.judge_questions:
        if q.related_lead not in valid:
            q.related_lead = ""
    insight.headline, insight.simple_summary = out.headline, out.simple_summary
    insight.gaps, insight.ideas, insight.pitch_line, insight.judge_questions = out.gaps, out.ideas, out.pitch_line, out.judge_questions


def get_result(aid: str) -> dict | None:
    if aid in RUNNING:
        return RUNNING[aid].model_dump()
    return store.get_analysis(aid)


# ------------------------------------------------------------------ extra AI features
def leads_block(leads: list[dict], numbered: bool = False, chars: int = 1500) -> str:
    out = []
    for n, l in enumerate(leads, 1):
        it = l["item"]
        head = f"[{n}] " if numbered else ""
        out.append(f"{head}<source id=\"{it['id']}\" type=\"{it['type']}\" title=\"{it['title']}\" year=\"{it.get('year') or ''}\">\n"
                   f"{it['text'][:chars]}\n</source>")
    return "\n".join(out)


async def summarize_item(item) -> dict:
    cached = store.get_summary(item.id)
    if cached:
        return cached
    if not gemma.available:
        raise GemmaUnavailable(gemma.error or "Gemma not configured")
    from pydantic import BaseModel

    class ProjectSummary(BaseModel):
        one_liner: str = ""
        what_it_does: str = ""
        key_features: list[str] = []
        tech_stack: list[str] = []
        how_it_works: str = ""
        audience: str = ""
        getting_started: str = ""
        maturity: str = ""
        maturity_reason: str = ""
        limitations: str = ""
        evidence_quotes: list[str] = []
        eli5: str = ""

    class PaperSummary(BaseModel):
        one_liner: str = ""
        problem: str = ""
        method: str = ""
        data: str = ""
        findings: str = ""
        limitations: str = ""
        key_terms: list[str] = []
        evidence_quotes: list[str] = []
        eli5: str = ""

    if item.type == "project":
        s = await gemma.json(prompts.project_summary(item.title, item.url, json.dumps(item.meta)[:600], item.text), ProjectSummary)
    else:
        s = await gemma.json(prompts.paper_summary(item.title, item.url, item.text), PaperSummary)
    d = s.model_dump()
    d["evidence"] = [{"quote": q, "verified": verify_quote(q, item.text)} for q in d.pop("evidence_quotes")]
    store.save_summary(item.id, d, gemma.model)
    return store.get_summary(item.id)
