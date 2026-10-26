import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, Archive, Blocks, Compass, GitFork, Github, Hammer, Layers, Lightbulb, Loader2, Puzzle, Rocket, Scale, Sparkles, Star, Target, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Busy, ExtLink, Label, Mermaid, RelevanceBar, SourceStatusBar } from "../../components/kit";
import { SummaryCard } from "../../components/SummaryCard";
import { Drawer, Empty, ErrorBox } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws, type Evidence, type RunInfo } from "../../lib/ws";
import { useProject } from "../Workspace";
import { QueryEditor } from "./Research";

const CAT: Record<string, { label: string; cls: string; icon: React.ReactNode; desc: string }> = {
  direct_match: { label: "Direct match", cls: "from-rose-500 to-pink-600", icon: <Target size={12} />, desc: "Already implements most of your idea" },
  building_block: { label: "Building block", cls: "from-emerald-500 to-teal-600", icon: <Blocks size={12} />, desc: "Reusable component for part of it" },
  inspiration: { label: "Inspiration", cls: "from-sky-500 to-indigo-600", icon: <Lightbulb size={12} />, desc: "Related reference, not directly reusable" },
  not_relevant: { label: "Not relevant", cls: "from-slate-400 to-slate-500", icon: <AlertTriangle size={12} />, desc: "Judged unrelated" },
};
const LANG_COLORS: Record<string, string> = { Python: "#3572A5", JavaScript: "#F1E05A", TypeScript: "#3178C6", Java: "#B07219", Kotlin: "#A97BFF", Go: "#00ADD8", Rust: "#DEA584", "C++": "#F34B7D", Jupyter: "#DA5B0B", Dart: "#00B4AB" };

function RepoCard({ e, i, onOpen }: { e: Evidence; i: number; onOpen: () => void }) {
  const it = e.item, c = e.category ? CAT[e.category] : null;
  const name = it.meta?.full_name || it.url.replace("https://github.com/", "");
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} onClick={onOpen}
      className="glass-card glass-hover group flex cursor-pointer flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`https://github.com/${name.split("/")[0]}.png?size=64`} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-slate-200 dark:bg-white/10" loading="lazy" onError={(ev) => ((ev.target as HTMLImageElement).style.visibility = "hidden")} />
          <div className="min-w-0"><div className="truncate text-xs text-ink-mute">{name.split("/")[0]}</div>
            <h3 className="truncate font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-300">{name.split("/")[1] || it.title}</h3></div>
        </div>
        {c && <span className={clsx("chip shrink-0 bg-gradient-to-r text-white", c.cls)} title={c.desc}>{c.icon}{c.label}</span>}
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] text-ink-soft dark:text-slate-300">{it.meta?.description || it.text.slice(0, 200)}</p>
      {e.reason && <p className="mt-2 line-clamp-2 rounded-lg bg-brand-500/[.07] px-3 py-2 text-xs"><Sparkles size={11} className="mr-1 inline text-brand-500" />{e.reason}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-ink-mute">
        {it.venue_or_language && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLORS[it.venue_or_language] || "#94A3B8" }} />{it.venue_or_language}</span>}
        {it.meta?.stars != null && <span className="flex items-center gap-1"><Star size={12} />{Number(it.meta.stars).toLocaleString()}</span>}
        {it.meta?.forks != null && <span className="flex items-center gap-1"><GitFork size={12} />{it.meta.forks}</span>}
        {it.meta?.license && <span className="flex items-center gap-1"><Scale size={12} />{it.meta.license}</span>}
        {it.meta?.archived && <span className="flex items-center gap-1 text-amber-600"><Archive size={12} />archived</span>}
        <span className="ml-auto"><RelevanceBar value={e.relevance} /></span>
      </div>
    </motion.article>
  );
}

function BuildPlan({ plan, repos, onOpen }: { plan: any; repos: Evidence[]; onOpen: (id: string) => void }) {
  const title = (id: string) => repos.find((r) => r.item.id === id)?.item.title || id.replace("proj:", "");
  return (
    <div className="space-y-6">
      <div className={clsx("glass-card gradient-border relative overflow-hidden p-6", plan.mode === "differentiate" ? "" : "")}>
        <div className="flex flex-wrap items-center gap-2"><Label tone="rec">AI build plan</Label>
          <span className={clsx("pill", plan.mode === "differentiate" ? "border-rose-400/40 text-rose-600 dark:text-rose-300" : "border-emerald-400/40 text-emerald-600 dark:text-emerald-300")}>
            {plan.mode === "differentiate" ? <><Target size={11} /> Similar projects exist: plan focuses on differentiation</> : <><Blocks size={11} /> No direct match: build from reusable blocks</>}</span></div>
        <p className="mt-3 text-[15px] leading-relaxed">{plan.approach}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="glass-card p-6">
          <div className="section-title mb-5"><Workflow size={16} className="text-violet-500" /> Step-by-step workflow</div>
          <ol className="relative space-y-5 border-l-2 border-dashed border-brand-300/50 pl-7 dark:border-brand-400/25">
            {(plan.workflow || []).map((s: any, i: number) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative">
                <span className="absolute -left-[42px] flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white shadow-glow">{s.step ?? i + 1}</span>
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{s.title}</span>{s.effort_hours != null && <span className="chip bg-slate-100 text-ink-mute dark:bg-white/[.06]">~{s.effort_hours}h</span>}</div>
                <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{s.details}</p>
                {s.output && <p className="mt-1 text-xs text-ink-mute">→ Output: {s.output}</p>}
                {s.repos?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{s.repos.map((r: string) => (
                  <button key={r} onClick={() => onOpen(r)} className="chip border border-violet-300/50 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200"><Github size={11} />{title(r)}</button>))}</div>}
              </motion.li>))}
          </ol>
        </div>
        <div className="space-y-6">
          {plan.mermaid && <div className="glass-card p-5"><div className="section-title mb-3"><Layers size={16} className="text-cyan-500" /> System sketch</div><Mermaid code={plan.mermaid} /></div>}
          {plan.recommended_stack?.length > 0 && <div className="glass-card p-5"><div className="section-title mb-3"><Hammer size={16} className="text-amber-500" /> Recommended stack</div>
            <div className="space-y-2">{plan.recommended_stack.map((s: any, i: number) => (
              <div key={i} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[.03]"><span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-mute">{s.layer}</span>
                <span><b>{s.choice}</b><span className="block text-xs text-ink-mute">{s.why}</span></span></div>))}</div></div>}
        </div>
      </div>
      {plan.additional_features?.length > 0 && <div><div className="section-title mb-3"><Rocket size={16} className="text-fuchsia-500" /> Additional features to stand out</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{plan.additional_features.map((f: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card glass-hover p-5">
            <div className="flex items-start justify-between gap-2"><span className="font-semibold">{f.title}</span><span className={clsx("chip", f.effort === "low" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : f.effort === "high" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-300")}>{f.effort}</span></div>
            <p className="mt-1.5 text-sm text-ink-soft dark:text-slate-300">{f.why}</p></motion.div>))}</div></div>}
      {plan.risks?.length > 0 && <div className="glass-card p-5"><div className="section-title mb-2"><AlertTriangle size={16} className="text-amber-500" /> Risks</div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft dark:text-slate-300">{plan.risks.map((r: any, i: number) => <li key={i}>{typeof r === "string" ? r : `${r.risk}: ${r.mitigation}`}</li>)}</ul></div>}
    </div>
  );
}

export default function GithubView() {
  const { project, reload, go } = useProject();
  const q = project.queries;
  const [queries, setQueries] = useState<string[]>([...(q?.github_queries ?? [project.title])]);
  const [items, setItems] = useState<Evidence[]>([]);
  const [run, setRun] = useState<Omit<RunInfo, "results"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Evidence | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    ws.evidence(project.id, "github").then(setItems).catch(() => {});
    ws.artifact(project.id, "github_run").then((r) => r?.queries && setRun(r)).catch(() => {});
    ws.artifact(project.id, "build_plan").then((p) => p?.workflow && setPlan(p)).catch(() => {});
  }, [project.id]);

  const search = async () => {
    setBusy(true); setError(null);
    try {
      const custom = JSON.stringify(queries) !== JSON.stringify(q?.github_queries ?? []);
      const r = await ws.github(project.id, custom ? queries : []); setRun(r); setItems(r.results); reload();
    } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  const makePlan = async () => { setPlanBusy(true); setError(null); try { setPlan(await ws.buildPlan(project.id)); } catch (e) { setError(e as ApiError); } finally { setPlanBusy(false); } };
  const counts = useMemo(() => Object.fromEntries(Object.keys(CAT).map((k) => [k, items.filter((x) => x.category === k).length])), [items]);
  const ORDER: Record<string, number> = { direct_match: 0, building_block: 1, inspiration: 2, not_relevant: 4 };
  const shown = items.filter((x) => filter === "all" || x.category === filter).sort((a, b) => (ORDER[a.category ?? ""] ?? 3) - (ORDER[b.category ?? ""] ?? 3) || b.relevance - a.relevance);
  const openId = (id: string) => setOpen(items.find((x) => x.item.id === id) || null);

  return (
    <div className="space-y-6">
      <QueryEditor queries={queries} setQueries={setQueries} onRun={search} busy={busy} />
      {run && <SourceStatusBar statuses={run.statuses} fallback={run.fallback_local} />}
      <ErrorBox error={error} />

      {busy ? <Busy label="Searching GitHub and classifying repositories with Gemma 4…" steps={["Searching end-to-end implementations…", "Searching reusable building blocks…", "Reading READMEs…", "Classifying: direct match, building block or inspiration…"]} />
        : items.length === 0 ? <Empty icon={<Github />} title="No repositories yet">Search to find projects that already implement your idea, plus libraries you can build it from.</Empty> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["direct_match", "building_block", "inspiration"] as const).map((k) => (
                <button key={k} onClick={() => setFilter(filter === k ? "all" : k)} className={clsx("glass-card glass-hover flex items-center gap-4 p-4 text-left", filter === k && "ring-2 ring-brand-500")}>
                  <span className={clsx("icon-tile bg-gradient-to-br", CAT[k].cls)}>{CAT[k].icon}</span>
                  <span><span className="block text-2xl font-extrabold">{counts[k] ?? 0}</span><span className="block text-xs text-ink-mute">{CAT[k].label}s · {CAT[k].desc}</span></span>
                </button>))}
            </div>
            <div className="glass-card flex flex-wrap items-center gap-4 p-5">
              <div className={clsx("icon-tile bg-gradient-to-br", counts.direct_match ? "from-rose-500 to-orange-500" : "from-emerald-500 to-teal-500")}>{counts.direct_match ? <Target size={18} /> : <Puzzle size={18} />}</div>
              <div className="min-w-0 flex-1 text-sm">{counts.direct_match
                ? <><b>{counts.direct_match} repositor{counts.direct_match > 1 ? "ies" : "y"} already implement much of your idea.</b> Generate a plan that reuses their strengths and focuses on what makes yours different.</>
                : <><b>No repository implements your idea end to end.</b> Generate a step-by-step plan to build it from the {counts.building_block || "related"} reusable building blocks found.</>}</div>
              <button className="btn-primary" onClick={makePlan} disabled={planBusy}>{planBusy ? <Loader2 size={16} className="animate-spin" /> : <Workflow size={16} />} {plan ? "Regenerate build plan" : "Generate build plan"}</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{shown.map((e, i) => <RepoCard key={e.item.id} e={e} i={i} onOpen={() => setOpen(e)} />)}</div>
          </>)}

      {planBusy ? <Busy label="Designing your build workflow…" steps={["Picking reusable components…", "Ordering the workflow…", "Choosing the stack…", "Adding standout features…"]} /> : plan && <BuildPlan plan={plan} repos={items} onOpen={openId} />}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && <div>
        <div className="flex items-center gap-2">{open.category && <span className={clsx("chip bg-gradient-to-r text-white", CAT[open.category].cls)}>{CAT[open.category].icon}{CAT[open.category].label}</span>}<span className="text-xs text-ink-mute">{open.item.source}</span></div>
        <h2 className="mt-1.5 text-lg font-bold">{open.item.meta?.full_name || open.item.title}</h2></div>}>
        {open && <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><ExtLink href={open.item.url}>Open on GitHub</ExtLink>
            <button className="btn-primary !py-1.5 text-xs" onClick={() => go("onboarding", `url=${encodeURIComponent(open.item.url)}`)}><Compass size={14} /> Understand this repository</button></div>
          {open.reason && <div className="rounded-xl bg-brand-500/10 p-4 text-sm"><Label tone="ai">Why it's listed</Label><p className="mt-1">{open.reason}</p>
            {open.helps_with && <p className="mt-1 text-xs text-ink-mute">Helps with: {open.helps_with} · reuse value: {open.reuse_value}</p>}</div>}
          <SummaryCard item={open.item} projectId={project.id} />
          <div><Label tone="fact">README excerpt</Label><p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed dark:bg-white/[.04]">{open.item.text}</p></div>
        </div>}
      </Drawer>
    </div>
  );
}
