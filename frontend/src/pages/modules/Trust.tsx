import clsx from "clsx";
import { AlertTriangle, ArrowRight, CheckCircle2, Database, FileText, Github, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Busy } from "../../components/kit";
import { api } from "../../lib/api";
import { useApp } from "../../lib/store";
import { useProject } from "../Workspace";
import { useProjectData } from "./hooks";

type Check = { name: string; id: string; count: number | string; total?: number; ok: boolean; note: string };

export default function TrustView() {
  const { project } = useProject();
  const { health } = useApp();
  const { analysis, evidence, research, github, loaded } = useProjectData(project);
  const [coll, setColl] = useState<any>(null);
  useEffect(() => { api.collection("seed").then(setColl).catch(() => {}); }, []);
  if (!loaded) return <Busy label="Running data checks…" />;

  const statuses = [...(research?.statuses || []), ...(github?.statuses || [])];
  const live = statuses.filter((s: any) => s.ok).length;
  const thin = evidence.filter((e) => (e.item.text || "").length < 300);
  const noYear = evidence.filter((e) => !e.item.year);
  const titles = evidence.map((e) => e.item.title.toLowerCase().replace(/\W+/g, ""));
  const dupes = titles.length - new Set(titles).size;
  const quotes = analysis ? analysis.leads.flatMap((l) => l.report ? [...l.report.aspects, ...l.report.contribution_matches].filter((x) => x.evidence_quote) : []) : [];
  const unverified = quotes.filter((q) => !q.verified).length;
  const noReport = analysis ? analysis.leads.filter((l) => !l.report).length : 0;
  const papers = evidence.filter((e) => e.kind === "paper").length, patents = evidence.filter((e) => e.kind === "patent").length, repos = evidence.filter((e) => e.kind === "repo").length;
  const embedder = analysis?.embedder || coll?.embedder || "unknown";

  const checks: Check[] = [
    { name: "Every source reachable", id: "sources.reachable", count: statuses.length - live, total: statuses.length, ok: statuses.length > 0 && live === statuses.length,
      note: statuses.length === 0 ? "No discovery has run yet." : live === statuses.length ? "Passed: all sources answered." : `Flagged: ${statuses.filter((s: any) => !s.ok).map((s: any) => s.source).join(", ")} did not answer; affected results came from the local collection.` },
    { name: "Research used live results", id: "research.fallback", count: research?.fallback_local ? 1 : 0, ok: !!research && !research.fallback_local,
      note: !research ? "Not run." : research.fallback_local ? "Flagged: papers came from the local bounded collection because live sources were unreachable." : "Passed." },
    { name: "GitHub used live results", id: "github.fallback", count: github?.fallback_local ? 1 : 0, ok: !!github && !github.fallback_local,
      note: !github ? "Not run." : github.fallback_local ? "Flagged: repositories came from the local seed collection (no stars/licence metadata)." : "Passed." },
    { name: "Patent records are live", id: "patents.live", count: patents, ok: patents > 0, note: patents > 0 ? "Passed: PatentsView records retrieved." : "Caveat: only search links to patent offices are shown. Set PATENTSVIEW_API_KEY for live records." },
    { name: "Evidence has enough text to judge", id: "evidence.thin_text", count: thin.length, total: evidence.length, ok: thin.length === 0,
      note: thin.length ? "Flagged: short abstracts/READMEs give weaker summaries; treat their verdicts with care." : "Passed." },
    { name: "Duplicate evidence removed", id: "evidence.duplicates", count: dupes, total: evidence.length, ok: dupes === 0, note: dupes ? "Flagged: duplicate titles across sources." : "Passed: deduplicated by id and title." },
    { name: "Evidence has a date", id: "evidence.missing_year", count: noYear.length, total: evidence.length, ok: noYear.length === 0, note: noYear.length ? "Caveat: undated items are excluded from timelines." : "Passed." },
    { name: "Quotes verified word-for-word", id: "novelty.unverified_quotes", count: unverified, total: quotes.length, ok: !!analysis && unverified === 0,
      note: !analysis ? "Novelty analysis not run yet." : unverified ? `Flagged: ${unverified} quotes not found in the source; they are excluded from all scores.` : "Passed: every quote appears in its source." },
    { name: "Every lead compared by AI", id: "novelty.missing_reports", count: noReport, total: analysis?.leads.length, ok: !!analysis && noReport === 0,
      note: !analysis ? "Not run." : noReport ? "Flagged: some leads have retrieval scores only." : "Passed." },
    { name: "Collection includes papers", id: "collection.papers", count: coll?.by_type?.paper ?? 0, ok: (coll?.by_type?.paper ?? 0) + papers > 0,
      note: (coll?.by_type?.paper ?? 0) + papers > 0 ? "Passed." : "Flagged: no papers in the bounded collection, so related research could be missed (coverage is capped at medium)." },
    { name: "Open-weight embeddings in use", id: "retrieval.embedder", count: embedder.startsWith("EmbeddingGemma") ? "EmbeddingGemma" : "LSA", ok: embedder.startsWith("EmbeddingGemma"),
      note: embedder.startsWith("EmbeddingGemma") ? "Passed." : "Caveat: EmbeddingGemma is not installed; the offline TF-IDF+SVD fallback is used for semantic retrieval." },
  ];
  const flagged = checks.filter((c) => !c.ok).length;

  const Node = ({ label, tag, cls = "tag-real" }: { label: string; tag: string; cls?: string }) => (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] dark:border-white/10 dark:bg-white/[.05]">{label}<span className={cls}>{tag}</span></span>);
  const Arrow = () => <ArrowRight size={13} className="text-ink-mute" />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Evidence items", evidence.length, `${papers} papers · ${patents} patents · ${repos} repos`, <FileText size={14} />],
          ["Sources live", statuses.length ? `${live}/${statuses.length}` : "n/a", "per discovery run", <Github size={14} />],
          ["Verified quotes", quotes.length ? `${Math.round(((quotes.length - unverified) / quotes.length) * 100)}%` : "n/a", `${quotes.length - unverified} of ${quotes.length} in novelty report`, <ShieldCheck size={14} />],
          ["Bounded collection", analysis?.searched ?? coll?.total ?? "n/a", analysis ? analysis.collection : "seed collection", <Database size={14} />]].map(([l, v, s, i]) => (
          <div key={l as string} className="glass-card p-4"><div className="flex items-center justify-between text-[11px] font-medium text-ink-mute"><span>{l}</span>{i}</div>
            <div className="mt-1 text-[26px] font-bold tracking-tight">{v}</div><div className="text-[11px] text-ink-mute">{s}</div></div>))}
      </div>

      <div className="glass-card p-5">
        <div className="section-title">Data lineage</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Node label="Your idea / proposal" tag="input" /><Arrow /><Node label={`Brief: ${project.brief?.contributions.length ?? 0} contributions`} tag={project.brief?.generated_by === "gemma" ? "Gemma 4" : "heuristic"} cls="tag-ai" /><Arrow />
          <Node label="Search queries per source" tag="Gemma 4" cls="tag-ai" /><Arrow />
          {(statuses.length ? statuses : [{ source: "Sources", ok: false, note: "not run" }]).map((s: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-1.5">{i > 0 && <span className="text-ink-mute">+</span>}<Node label={s.source} tag={s.ok ? `real · ${s.count}` : s.note ? "needs key" : "unreachable"} cls={s.ok ? "tag-real" : "tag-warn"} /></span>))}
          <Arrow /><Node label={`Evidence library · ${evidence.length}`} tag={research?.fallback_local || github?.fallback_local ? "incl. local" : "real"} cls={research?.fallback_local || github?.fallback_local ? "tag-warn" : "tag-real"} />
          <Arrow /><Node label={`Bounded collection · ${analysis?.searched ?? "n/a"}`} tag="fixed" /><Arrow />
          <Node label="Novelty analysis" tag={analysis ? `${analysis.leads.length} leads` : "not run"} cls={analysis ? "tag-ai" : "tag-warn"} />
        </div>
        <p className="mt-3 text-[11.5px] text-ink-mute">Green tags mark retrieved real records, indigo tags mark AI-generated content, and amber tags mark limitations. No data in this app is simulated.</p>
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/[.08]"><div className="section-title">Quality checks <span className="font-normal text-ink-mute">· {flagged} flagged, {checks.length - flagged} passed</span></div>
          <span className="pill border-slate-200 text-ink-mute dark:border-white/10"><Sparkles size={11} /> AI: {health?.ai.model || "offline"}</span></div>
        {checks.map((c) => (
          <div key={c.id} className="grid grid-cols-[22px_minmax(0,1.3fr)_70px_60px_minmax(0,2fr)] items-center gap-3 border-b border-slate-100 px-5 py-3 text-[13px] last:border-0 dark:border-white/[.05]">
            {c.ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
            <div className="min-w-0"><div className="font-medium">{c.name}</div><div className="truncate font-mono text-[10.5px] text-ink-mute">{c.id}</div></div>
            <div className="text-right font-mono">{c.count}</div>
            <div>{c.total ? <span className={clsx("conf", c.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>{Math.round((Number(c.count) / c.total) * 100)}%</span> : null}</div>
            <div className={clsx("text-[12px]", c.ok ? "text-ink-mute" : "text-amber-700 dark:text-amber-300")}>{c.note}</div>
          </div>))}
      </div>
    </div>
  );
}
