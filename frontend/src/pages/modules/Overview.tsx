import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, BookOpenText, CheckCircle2, Circle, Github, Loader2, Pencil, Rocket, Save, Search, Sparkles, Target, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBox } from "../../components/ui";
import { ApiError, type Brief } from "../../lib/api";
import { ws } from "../../lib/ws";
import { useProject } from "../Workspace";
import { pct, useProjectData } from "./hooks";
import { Conf, LEVEL_BAR, LEVEL_TXT, rankContributions } from "./Investigate";

const FIELDS: [keyof Brief, string][] = [["problem", "Problem"], ["target_users", "Users"], ["method", "Approach"], ["data", "Data"], ["platform", "Platform"], ["expected_outcome", "Outcome"]];

function Spark({ values, color = "bg-gradient-to-t from-brand-600 to-cyan-400" }: { values: number[]; color?: string }) {
  const max = Math.max(1e-9, ...values);
  return <div className="mt-2 flex h-6 items-end gap-[2px]">{values.slice(0, 24).map((v, i) => <span key={i} className={clsx("w-1.5 rounded-sm", color)} style={{ height: `${Math.max(10, (v / max) * 100)}%` }} />)}</div>;
}

export default function OverviewView() {
  const { project, reload, go } = useProject();
  const b = project.brief!;
  const { analysis, evidence, research, github, plan } = useProjectData(project);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Brief>(b);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const rows = useMemo(() => (analysis?.insight ? rankContributions(analysis) : []), [analysis]);

  const runAll = async () => {
    setError(null);
    try {
      setRunning("Searching papers, patents and GitHub in parallel…");
      await Promise.all([ws.research(project.id, [], null), ws.github(project.id, [])]);
      setRunning("Writing a build plan from the repositories found…");
      await ws.buildPlan(project.id).catch(() => null);
      await reload();
    } catch (e) { setError(e as ApiError); } finally { setRunning(null); }
  };
  const saveBrief = async () => { await ws.putBrief(project.id, { ...draft, contributions: draft.contributions.filter((c) => c.trim()) }); setEdit(false); reload(); };

  const papers = evidence.filter((e) => e.kind === "paper"), patents = evidence.filter((e) => e.kind === "patent"), repos = evidence.filter((e) => e.kind === "repo");
  const direct = repos.filter((r) => r.category === "direct_match").length, blocks = repos.filter((r) => r.category === "building_block").length;
  const quotes = analysis ? analysis.leads.flatMap((l) => l.report ? [...l.report.aspects, ...l.report.contribution_matches].filter((x) => x.evidence_quote) : []) : [];
  const vr = quotes.length ? quotes.filter((q) => q.verified).length / quotes.length : null;
  const high = rows.filter((r) => r.level === "high").length;
  const fallback = research?.fallback_local || github?.fallback_local;

  const headline = !research && !github ? "Start with discovery: find what already exists for this idea"
    : rows.length ? `${rows[0].contribution.split(/[,(]/)[0].slice(0, 70)} is the top claim to investigate`
      : direct ? `${direct} repositor${direct > 1 ? "ies" : "y"} already implement much of this idea` : "No end-to-end implementation found; build from reusable parts";
  const bullets: string[] = [];
  if (research) bullets.push(`${papers.length} papers and ${patents.length} patents collected${research.fallback_local ? " (live paper sources were unreachable, so the local collection was used)" : ""}.`);
  if (github) bullets.push(`${repos.length} repositories: ${direct} direct matches, ${blocks} building blocks${github.fallback_local ? " (from the local collection)" : ""}.`);
  if (rows.length) bullets.push(`${high} of ${rows.length} claimed contributions have strong verified overlap; ${rows.filter((r) => r.level === "low").length} ${rows.filter((r) => r.level === "low").length === 1 ? "shows" : "show"} little matching evidence.`);
  if (vr != null) bullets.push(`${Math.round(vr * 100)}% of ${quotes.length} evidence quotes were verified word-for-word in their sources.`);
  if (plan) bullets.push(`A ${plan.workflow.length}-step build plan is ready (${plan.mode === "differentiate" ? "focus on differentiation" : "build from building blocks"}).`);
  if (!bullets.length) bullets.push("Run full discovery to search papers, patents and GitHub in parallel; it takes about a minute.");

  const steps = [
    { k: "research", l: "Papers & patents searched", done: !!research }, { k: "github", l: "GitHub repositories classified", done: !!github },
    { k: "github", l: "Build plan generated", done: !!plan }, { k: "novelty", l: "Novelty report with verified evidence", done: !!analysis },
    { k: "architect", l: "Technical blueprint", done: project.artifacts.includes("architect") }, { k: "onboarding", l: "Repository onboarded", done: project.artifacts.includes("onboarding_scan") },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <div className="space-y-5">
      {/* today's briefing */}
      <section className="glass-card gradient-border relative overflow-hidden p-5"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="flex flex-wrap items-start gap-4">
          <div className="icon-tile"><Sparkles size={17} /></div>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Today's briefing</div>
            <div className="mt-0.5 text-[16px] font-semibold">{headline}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600 dark:text-slate-300">{bullets.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
            {rows.length > 0 && <button className="btn-primary" onClick={() => go("investigate")}>Why? View evidence</button>}
            <button className={rows.length ? "btn-outline" : "btn-primary"} onClick={runAll} disabled={!!running}>{running ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} {research ? "Re-run discovery" : "Run full discovery"}</button>
            {next && <button className="btn-ghost !py-1.5 text-xs" onClick={() => go(next.k)}>Next: {next.l} <ArrowRight size={13} /></button>}
          </div>
        </div>
        {running && <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-[13px] text-brand-700 dark:text-brand-300"><Loader2 size={14} className="animate-spin" /> {running}</div>}
        {fallback && <p className="mt-3 text-[11.5px] text-amber-600 dark:text-amber-400">Some live sources were unreachable from this server, so the local bounded collection was used. Details are in the Data trust centre.</p>}
        <div className="mt-3"><ErrorBox error={error} /></div>
      </section>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { l: "Papers", v: papers.length, s: `${patents.length} patents · ${research ? "searched" : "not searched"}`, i: <BookOpenText size={14} />, spark: papers.map((p) => p.relevance), k: "research" },
          { l: "GitHub repos", v: repos.length, s: `${direct} direct · ${blocks} building blocks`, i: <Github size={14} />, spark: repos.map((r) => r.relevance), k: "github" },
          { l: "High-overlap claims", v: rows.length ? `${high}/${rows.length}` : "n/a", s: "verified evidence only", i: <Target size={14} />, spark: rows.map((r) => r.score), k: "investigate", color: "bg-rose-500/70" },
          { l: "Verified quotes", v: pct(vr), s: quotes.length ? `${quotes.length} quotes checked` : "run novelty report", i: <BadgeCheck size={14} />, spark: analysis ? analysis.leads.map((l) => l.similarity) : [], k: "trust", color: "bg-emerald-500/70" },
          { l: "Build plan", v: plan ? `${plan.workflow.length} steps` : "n/a", s: plan ? (plan.mode === "differentiate" ? "differentiate" : "from building blocks") : "after GitHub search", i: <Rocket size={14} />, spark: plan ? plan.workflow.map((w: any) => w.effort_hours || 1) : [], k: "github" },
        ].map((t, i) => (
          <motion.button key={t.l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => go(t.k)} className="glass-card glass-hover p-4 text-left">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-mute"><span>{t.l}</span>{t.i}</div>
            <div className="mt-1 text-[26px] font-bold tracking-tight">{t.v}</div><div className="truncate text-[11px] text-ink-mute">{t.s}</div>
            {t.spark.length > 0 && <Spark values={t.spark} color={t.color} />}
          </motion.button>))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="glass-card p-5">
          <div className="flex items-center justify-between"><div><div className="section-title">Investigate first</div><div className="text-[11.5px] text-ink-mute">Claims ranked by verified overlap · confidence</div></div>
            <button className="btn-ghost !py-1 text-xs" onClick={() => go("investigate")}>All <ArrowRight size={13} /></button></div>
          {rows.length === 0 ? <div className="mt-6 text-center text-[13px] text-ink-mute">No ranking yet. <button className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => go("novelty")}>Run the novelty report →</button></div> : (
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[.05]">{rows.slice(0, 5).map((r, i) => (
              <div key={r.index} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold dark:bg-white/[.07]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{r.contribution}</span>
                <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[.07] sm:block"><div className={clsx("h-full", LEVEL_BAR[r.level])} style={{ width: `${Math.min(100, (r.score / Math.max(1, rows[0].score)) * 100)}%` }} /></div>
                <span className={clsx("w-14 text-right text-[12px] font-semibold capitalize", LEVEL_TXT[r.level])}>{r.level}</span><Conf c={r.confidence} />
              </div>))}</div>)}
        </section>
        <section className="glass-card p-5">
          <div className="section-title">Progress</div>
          <div className="mt-3 space-y-1">{steps.map((s, i) => (
            <button key={i} onClick={() => go(s.k)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-white/[.03]">
              {s.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-400" />}
              <span className={clsx("flex-1", !s.done && "text-ink-mute")}>{s.l}</span><ArrowRight size={13} className="text-ink-mute" /></button>))}</div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="glass-card p-5">
          <div className="flex items-center justify-between"><div className="section-title">Structured brief <span className="tag-ai">{b.generated_by === "gemma" ? "Gemma 4" : "heuristic"}</span></div>
            <button className="btn-ghost !py-1 text-xs" onClick={() => { setDraft(b); setEdit(true); }}><Pencil size={13} /> Edit</button></div>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{FIELDS.map(([k, l]) => <div key={k}><dt className="label">{l}</dt><dd className="mt-0.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{b[k] as string}</dd></div>)}</dl>
          <div className="label mt-4">Claimed contributions</div>
          <ol className="mt-1.5 space-y-1.5">{b.contributions.map((c, i) => <li key={i} className="flex gap-2.5 text-[13px]"><span className="font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400">C{i + 1}</span>{c}</li>)}</ol>
        </section>
        {project.queries && <section className="glass-card p-5">
          <div className="section-title"><Search size={14} className="text-brand-500" /> Search queries <span className="tag-ai">Gemma 4</span></div>
          {([["Papers", "paper_queries"], ["Patents", "patent_queries"], ["GitHub", "github_queries"], ["Building blocks", "building_block_queries"]] as const).map(([l, k]) => (
            <div key={k} className="mt-3"><div className="label mb-1">{l}</div><div className="flex flex-wrap gap-1.5">{(project.queries![k] || []).map((q) => <span key={q} className="rounded-md border border-slate-200 px-2 py-0.5 text-[11.5px] text-slate-600 dark:border-white/10 dark:text-slate-300">{q}</span>)}</div></div>))}
        </section>}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setEdit(false)}>
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card max-h-[88vh] w-full max-w-3xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Edit brief</h3><button className="btn-ghost !p-1.5" onClick={() => setEdit(false)}><X size={18} /></button></div>
            <label className="label">Title</label><input className="input mb-3 mt-1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(([k, l]) => <div key={k}><label className="label">{l}</label>
              <textarea rows={3} className="input mt-1 text-[13px]" value={draft[k] as string} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></div>)}</div>
            <label className="label mt-3 block">Contributions (one per line)</label>
            <textarea rows={6} className="input mt-1 text-[13px]" value={draft.contributions.join("\n")} onChange={(e) => setDraft({ ...draft, contributions: e.target.value.split("\n") })} />
            <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEdit(false)}>Cancel</button><button className="btn-primary" onClick={saveBrief}><Save size={15} /> Save brief</button></div>
          </motion.div>
        </div>)}
    </div>
  );
}
