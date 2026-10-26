export type Level = "high" | "medium" | "low";
export type ReviewState = "unreviewed" | "relevant" | "not_relevant" | "needs_reading";

export interface Item {
  id: string; type: "paper" | "project"; title: string; text: string; authors_or_owner: string; year: number | null;
  venue_or_language: string; url: string; tags: string[]; meta: Record<string, any>; source: string; fetched_at?: string;
}
export interface Brief {
  title: string; problem: string; target_users: string; method: string; data: string; platform: string;
  expected_outcome: string; contributions: string[]; keywords: string[]; domain: string;
  figure_insights: { figure: number; description: string }[]; generated_by: "gemma" | "heuristic";
}
export interface AspectCmp { aspect: string; relation: "same" | "similar" | "different" | "unknown"; explanation: string; evidence_quote: string; verified: boolean }
export interface ContribMatch { contribution_index: number; relation: "covers" | "partially_covers" | "does_not_cover"; evidence_quote: string; verified: boolean }
export interface OverlapReport { lead_id: string; overlap_level: Level; aspects: AspectCmp[]; contribution_matches: ContribMatch[]; summary: string; key_difference: string; simple_summary: string }
export interface Lead { item: Item; rank: number; similarity: number; fused_score: number; matched_contributions: number[]; report: OverlapReport | null; review: ReviewState; note: string }
export interface Indicator { label: string; value: number; level: string; explanation: string }
export interface ContributionInsight { index: number; contribution: string; overlap_level: Level; score: number; supporting_leads: string[]; explanation: string; simple: string }
export interface Insight {
  overlap: Indicator; coverage: Indicator; confidence: Indicator; contributions: ContributionInsight[];
  headline: string; simple_summary: string; gaps: { title: string; detail: string; checked_leads: string[] }[];
  ideas: { title: string; detail: string; effort: "low" | "medium" | "high"; linked_gap: string }[];
  pitch_line: string; judge_questions: { question: string; suggested_answer: string; related_lead: string }[];
}
export interface Analysis {
  id: string; proposal_id: string; collection: string; status: "running" | "done" | "error"; ai_mode: "gemma" | "retrieval_only";
  model: string; embedder: string; brief: Brief; leads: Lead[]; insight: Insight | null; searched: number; error: string;
  map_points: { id: string; x: number; y: number; kind: string; lead?: boolean; title: string; similarity?: number }[];
  timeline: { year: number; paper: number; project: number }[]; timings: Record<string, number>; created_at: string;
}
export interface Health { ok: boolean; ai: { available: boolean; model: string; error: string }; collections: { name: string; items: number; custom: boolean }[] }

export class ApiError extends Error {
  constructor(message: string, public hint = "", public code = "") { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, init);
  } catch {
    throw new ApiError("Can't reach the IdeaForge server.", "Is the backend running on port 8000?");
  }
  if (!r.ok) {
    let body: any = {};
    try { body = await r.json(); } catch { /* not json */ }
    const e = body.error || {};
    throw new ApiError(e.message || body.detail || `Request failed (${r.status})`, e.hint || "", e.code || "");
  }
  return r.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => req<Health>("/api/health"),
  samples: () => req<{ id: string; title: string; preview: string }[]>("/api/samples"),
  recent: () => req<{ id: string; title: string; status: string; leads: number; overlap: string | null; created_at: string }[]>("/api/analyses"),
  createProposal: (fd: FormData) => req<{ id: string; name: string; chars: number; figures: string[]; preview: string }>("/api/proposals", { method: "POST", body: fd }),
  brief: (pid: string) => req<Brief>(`/api/proposals/${pid}/brief`, { method: "POST" }),
  startAnalysis: (proposal_id: string, collection: string, brief: Brief) => req<{ id: string }>("/api/analyses", json("POST", { proposal_id, collection, brief })),
  analysis: (id: string) => req<Analysis>(`/api/analyses/${id}`),
  review: (aid: string, leadId: string, state: ReviewState, note: string) =>
    req(`/api/analyses/${aid}/leads/${encodeURIComponent(leadId)}`, json("PATCH", { state, note })),
  ask: (aid: string, question: string) =>
    req<{ answer: string; confidence: string; citations: { lead_id: string; title: string; url: string; quote: string; verified: boolean }[] }>(`/api/analyses/${aid}/ask`, json("POST", { question })),
  relatedWork: (aid: string) => req<{ markdown: string; used_unreviewed: boolean; count: number }>(`/api/analyses/${aid}/related-work`, { method: "POST" }),
  collection: (name: string) => req<any>(`/api/collections/${name}`),
  items: (name: string, q: string, type: string, offset = 0) =>
    req<{ total: number; items: (Omit<Item, "text"> & { snippet: string; has_summary: boolean })[] }>(`/api/collections/${name}/items?q=${encodeURIComponent(q)}&type=${type}&offset=${offset}&limit=24`),
  itemSummary: (id: string, collection: string) => req<{ summary: any; model: string }>(`/api/items/${encodeURIComponent(id)}/summary?collection_name=${collection}`, { method: "POST" }),
  cachedSummary: (id: string) => req<{ summary?: any; model?: string }>(`/api/items/${encodeURIComponent(id)}/summary`),
  uploadCollection: (fd: FormData) => req<{ name: string; items: number; skipped: number }>("/api/collections/upload", { method: "POST", body: fd }),
  batch: (fd: FormData) => req<{ names: string[]; matrix: number[][]; pairs: { a: string; b: string; similarity: number }[]; nearest: { proposal: string; leads: { id: string; title: string; url: string }[] }[]; embedder: string }>("/api/batch-compare", { method: "POST", body: fd }),
};
