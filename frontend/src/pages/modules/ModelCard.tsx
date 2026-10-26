import { BadgeCheck, Cpu, FlaskConical, Layers, ScanSearch, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Busy } from "../../components/kit";
import { useApp } from "../../lib/store";
import { ws } from "../../lib/ws";
import { useProject } from "../Workspace";
import { pct, useProjectData } from "./hooks";

export default function ModelCardView() {
  const { project, go } = useProject();
  const { health } = useApp();
  const { analysis, loaded } = useProjectData(project);
  const [sys, setSys] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  useEffect(() => { fetch("/api/system").then((r) => r.json()).then(setSys).catch(() => {}); ws.runs().then(setRuns).catch(() => {}); }, []);
  if (!loaded) return <Busy label="Loading model card…" />;

  const quotes = analysis ? analysis.leads.flatMap((l) => l.report ? [...l.report.aspects, ...l.report.contribution_matches].filter((x) => x.evidence_quote) : []) : [];
  const vr = quotes.length ? quotes.filter((q) => q.verified).length / quotes.length : null;
  const latest = runs[0];
  const metrics = ["faithfulness", "answer_relevance", "context_precision", "context_recall", "citation_accuracy"];
  const label = (m: string) => m.replace("_", " ").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Generator", sys?.model || health?.ai.model || "offline", sys?.fallbacks?.length ? `fallback: ${sys.fallbacks.join(", ")}` : "Gemma 4 via Gemini API"],
          ["Verified quote rate", pct(vr), analysis ? `${quotes.length} quotes in the novelty report` : "run the novelty report"],
          ["Faithfulness (latest eval)", latest ? pct(latest.summary.faithfulness) : "n/a", latest ? `${latest.config.label} · ${latest.summary.questions} questions` : "no evaluation run yet"],
          ["Retrieval", analysis?.embedder?.split(" (")[0] || "Hybrid", "dense + BM25 · RRF k=60 · MMR λ=0.7"]].map(([l, v, s]) => (
          <div key={l} className="glass-card p-4"><div className="text-[11px] font-medium text-ink-mute">{l}</div><div className="mt-1 truncate text-[22px] font-bold tracking-tight text-brand-600 dark:text-brand-400">{v}</div><div className="truncate text-[11px] text-ink-mute">{s}</div></div>))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="glass-card p-5">
          <div className="section-title"><FlaskConical size={15} className="text-brand-500" /> Retrieval configurations, evaluated honestly</div>
          <p className="mt-1 text-[12px] text-ink-mute">Each bar is a real evaluation run on the same question set (higher is better). Faithfulness, relevance and precision are judged by Gemma 4; recall and citation accuracy are computed in code.</p>
          {runs.length === 0 ? <div className="mt-4 text-sm text-ink-mute">No runs yet. <button className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => go("evaluation")}>Open the evaluation workbench →</button></div> : (
            <div className="mt-4 space-y-4">{metrics.map((m) => (
              <div key={m}><div className="mb-1 text-[11.5px] font-semibold">{label(m)}</div>
                {runs.slice(0, 4).map((r) => { const v = r.summary[m]; return (
                  <div key={r.id} className="flex items-center gap-3 text-[11.5px]"><span className="w-28 shrink-0 truncate text-ink-mute">{r.config.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-white/[.07]"><div className="h-full rounded bg-brand-500/80" style={{ width: `${(v ?? 0) * 100}%` }} /></div>
                    <span className="w-10 text-right font-mono">{v == null ? "n/a" : v.toFixed(2)}</span></div>); })}</div>))}</div>)}
        </div>
        <div className="space-y-5">
          <div className="glass-card p-5">
            <div className="section-title"><Cpu size={15} className="text-brand-500" /> Models and why</div>
            <div className="mt-3 space-y-2 text-[13px]">
              {[["Gemma 4 26B-A4B (MoE)", "Primary generator. About 4B active parameters, so structured JSON comes back in about 8 s with thinking set to minimal."],
                ["Gemma 4 31B", "Automatic fallback on errors, and extra free-tier quota (each model has its own 16k tokens/min)."],
                ["EmbeddingGemma 300M", "Open-weight embeddings for semantic retrieval when installed; otherwise an offline TF-IDF + SVD fallback (shown in the Data trust centre)."],
                ["BM25 (rank_bm25)", "Exact-term retrieval fused with embeddings by Reciprocal Rank Fusion."]].map(([m, w]) => (
                <div key={m} className="rounded-lg border border-slate-200 p-3 dark:border-white/[.08]"><div className="font-semibold">{m}</div><div className="text-ink-mute">{w}</div></div>))}
            </div>
          </div>
          <div className="glass-card p-5">
            <div className="section-title"><BadgeCheck size={15} className="text-emerald-500" /> Grounding rules (enforced in code)</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600 dark:text-slate-300">
              <li>Every evidence quote is checked against the source (exact or ≥ 90% fuzzy match); unverified quotes never count.</li>
              <li>Citations to items that were not retrieved are stripped.</li>
              <li>Overlap, coverage and confidence are deterministic formulas, not model opinions. There is never a single "novelty %".</li>
              <li>Retrieved text is wrapped as untrusted data; instructions inside sources are ignored.</li>
              <li>Repository code is never executed; secret-looking values are masked.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="glass-card p-5"><div className="section-title"><ScanSearch size={15} className="text-brand-500" /> Retrieval settings</div>
          <dl className="mt-2 space-y-1 text-[12.5px]">{[["Queries", "whole brief + one per contribution"], ["Pool", "top-50 dense + top-50 BM25 per query"], ["Fusion", "RRF, k = 60"], ["Diversity", "MMR, λ = 0.7, top 12 leads"], ["Repo chunks", "60-line windows, 10-line overlap"]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-mute">{k}</dt><dd className="text-right font-mono text-[11.5px]">{v}</dd></div>))}</dl></div>
        <div className="glass-card p-5"><div className="section-title"><Layers size={15} className="text-brand-500" /> This project's run</div>
          <dl className="mt-2 space-y-1 text-[12.5px]">{[["Collection", analysis?.collection ?? "n/a"], ["Items searched", analysis?.searched ?? "n/a"], ["Leads compared", analysis?.leads.length ?? "n/a"],
            ["Retrieval time", analysis?.timings?.retrieval_s != null ? `${analysis.timings.retrieval_s}s` : "n/a"], ["Total time", analysis?.timings?.total_s != null ? `${analysis.timings.total_s}s` : "n/a"]].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-3"><dt className="text-ink-mute">{k}</dt><dd className="truncate text-right font-mono text-[11.5px]">{v}</dd></div>))}</dl></div>
        <div className="glass-card p-5"><div className="section-title"><ShieldAlert size={15} className="text-amber-500" /> Known limitations</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-slate-600 dark:text-slate-300">
            <li>Abstracts and READMEs are short, so verdicts are leads, not conclusions.</li>
            <li>"No match" means no match in this collection only.</li>
            <li>LLM-judge scores are imperfect; inspect the context.</li>
            <li>Free-tier quotas slow long runs (paced, not failed).</li>
            <li>Not a legal novelty or patentability opinion.</li>
          </ul></div>
      </div>
    </div>
  );
}
