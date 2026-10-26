"""Pydantic models shared by the pipeline and the API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Aspect = Literal["problem", "method", "data", "users", "platform", "outcome"]
Relation = Literal["same", "similar", "different", "unknown"]
Coverage = Literal["covers", "partially_covers", "does_not_cover"]
Level = Literal["high", "medium", "low"]
ReviewState = Literal["unreviewed", "relevant", "not_relevant", "needs_reading"]


class Item(BaseModel):
    id: str
    type: Literal["paper", "project"]
    title: str
    text: str
    authors_or_owner: str = ""
    year: int | None = None
    venue_or_language: str = ""
    url: str = ""
    tags: list[str] = []
    meta: dict = {}
    source: str = ""
    fetched_at: str = ""


# ----------------------------------------------------------------- Step A
class FigureInsight(BaseModel):
    figure: int
    description: str


class ProposalBrief(BaseModel):
    title: str = ""
    problem: str = ""
    target_users: str = ""
    method: str = ""
    data: str = ""
    platform: str = ""
    expected_outcome: str = ""
    contributions: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    figure_insights: list[FigureInsight] = Field(default_factory=list)
    domain: str = ""
    generated_by: str = "gemma"  # "gemma" | "heuristic"


# ----------------------------------------------------------------- Step C
class AspectComparison(BaseModel):
    aspect: Aspect
    relation: Relation = "unknown"
    explanation: str = ""
    evidence_quote: str = ""
    verified: bool = False


class ContributionMatch(BaseModel):
    contribution_index: int
    relation: Coverage = "does_not_cover"
    evidence_quote: str = ""
    verified: bool = False


class OverlapReport(BaseModel):
    lead_id: str
    overlap_level: Level = "low"
    aspects: list[AspectComparison] = Field(default_factory=list)
    contribution_matches: list[ContributionMatch] = Field(default_factory=list)
    summary: str = ""
    key_difference: str = ""
    simple_summary: str = ""


# ----------------------------------------------------------------- Step D
class ContributionInsight(BaseModel):
    index: int
    contribution: str
    overlap_level: Level
    score: float
    supporting_leads: list[str]
    explanation: str = ""
    simple: str = ""


class Gap(BaseModel):
    title: str
    detail: str
    checked_leads: list[str] = []


class Idea(BaseModel):
    title: str
    detail: str
    effort: Literal["low", "medium", "high"] = "medium"
    linked_gap: str = ""


class JudgeQuestion(BaseModel):
    question: str
    suggested_answer: str
    related_lead: str = ""


class Indicator(BaseModel):
    label: str
    value: float  # 0..1
    level: str
    explanation: str


class NoveltyInsight(BaseModel):
    overlap: Indicator
    coverage: Indicator
    confidence: Indicator
    contributions: list[ContributionInsight]
    headline: str = ""
    simple_summary: str = ""
    gaps: list[Gap] = []
    ideas: list[Idea] = []
    pitch_line: str = ""
    judge_questions: list[JudgeQuestion] = []


# ----------------------------------------------------------------- Leads
class Lead(BaseModel):
    item: Item
    rank: int
    similarity: float  # cosine to the whole brief, 0..1
    fused_score: float
    matched_contributions: list[int]
    report: OverlapReport | None = None
    review: ReviewState = "unreviewed"
    note: str = ""


class AnalysisResult(BaseModel):
    id: str
    proposal_id: str
    collection: str
    status: Literal["running", "done", "error"]
    ai_mode: Literal["gemma", "retrieval_only"]
    model: str = ""
    embedder: str = ""
    brief: ProposalBrief
    leads: list[Lead] = []
    insight: NoveltyInsight | None = None
    map_points: list[dict] = []
    timeline: list[dict] = []
    searched: int = 0
    error: str = ""
    created_at: str = ""
    timings: dict = {}
