import { ApiError, type Brief, type Item } from "./api";

export interface Project {
  id: string; title: string; idea: string; brief: Brief | null; created_at: string; updated_at: string;
  counts: Record<string, number>; artifacts: string[]; novelty_analysis: string | null;
  queries: { paper_queries: string[]; patent_queries: string[]; github_queries: string[]; building_block_queries: string[]; synonyms: string[] } | null;
}
export interface Evidence {
  module: string; item: Item; relevance: number; why: string[]; kind: "paper" | "patent" | "repo"; saved: boolean;
  category?: "direct_match" | "building_block" | "inspiration" | "not_relevant"; reason?: string; reuse_value?: string; helps_with?: string;
}
export interface SourceStatus { source: string; ok: boolean; count: number; error: string; note: string; at: string }
export interface RunInfo { queries: string[]; statuses: SourceStatus[]; fallback_local: boolean; patent_links?: { query: string; links: { name: string; url: string }[] }[]; results: Evidence[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(path, init); } catch { throw new ApiError("Can't reach the IdeaForge server.", "Is the backend running on port 8000?"); }
  if (!r.ok) {
    let b: any = {};
    try { b = await r.json(); } catch { /* not json */ }
    const e = b.error || {};
    throw new ApiError(e.message || b.detail || `Request failed (${r.status})`, e.hint || "", e.code || "");
  }
  return r.json();
}
const post = (body: unknown = {}): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const ws = {
  create: (fd: FormData) => req<Project>("/api/projects", { method: "POST", body: fd }),
  list: () => req<{ id: string; title: string; idea: string; created_at: string }[]>("/api/projects"),
  get: (id: string) => req<Project>(`/api/projects/${id}`),
  putBrief: (id: string, b: Brief) => req<Project>(`/api/projects/${id}/brief`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  evidence: (id: string, module: string) => req<Evidence[]>(`/api/projects/${id}/evidence?module=${module}`),
  save: (id: string, item_id: string, saved: boolean) => req(`/api/projects/${id}/evidence/save`, post({ item_id, saved })),
  artifact: <T = any>(id: string, kind: string) => req<T>(`/api/projects/${id}/artifacts/${kind}`),
  summary: (id: string, item_id: string) => req<{ summary: any; model: string }>(`/api/projects/${id}/items/summary`, post({ item_id, saved: false })),
  research: (id: string, queries: string[], year_from: number | null, include_patents = true) =>
    req<RunInfo>(`/api/projects/${id}/research/search`, post({ queries, year_from, include_patents })),
  gaps: (id: string) => req<any>(`/api/projects/${id}/research/gaps`, post()),
  compare: (id: string, ids: string[]) => req<any>(`/api/projects/${id}/compare`, post({ ids })),
  github: (id: string, queries: string[]) => req<RunInfo & { direct_matches: number }>(`/api/projects/${id}/github/search`, post({ queries })),
  buildPlan: (id: string) => req<any>(`/api/projects/${id}/github/build-plan`, post()),
  architect: (id: string, constraints = "", section = "", instruction = "") => req<any>(`/api/projects/${id}/architect`, post({ constraints, section, instruction })),
  novelty: (id: string) => req<{ id: string }>(`/api/projects/${id}/novelty`, post()),
  scan: (url: string, project_id = "") => req<any>("/api/onboarding/scan", post({ url, project_id })),
  scans: () => req<{ id: string; url: string; created_at: string }[]>("/api/onboarding/scans"),
  getScan: (sid: string) => req<any>(`/api/onboarding/${sid}`),
  file: (sid: string, path: string) => req<{ path: string; content: string; lines: number; masked: boolean }>(`/api/onboarding/${sid}/file?path=${encodeURIComponent(path)}`),
  askRepo: (sid: string, question: string) => req<any>(`/api/onboarding/${sid}/ask`, post({ question })),
  genSet: (scan_id: string, n: number) => req<any>("/api/eval/sets", post({ scan_id, n })),
  putSet: (sid: string, questions: any[]) => req<any>(`/api/eval/sets/${sid}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions }) }),
  run: (set_id: string, top_k: number, retriever: string, label: string) => req<any>("/api/eval/runs", post({ set_id, top_k, retriever, label })),
  runs: (set_id = "") => req<any[]>(`/api/eval/runs?set_id=${set_id}`),
  getRun: (rid: string) => req<any>(`/api/eval/runs/${rid}`),
};
