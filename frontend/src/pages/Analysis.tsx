import clsx from "clsx";
import { motion } from "framer-motion";
import { BarChart3, Bot, Check, Cpu, Database, Download, Loader2, Map as MapIcon, RotateCcw, ScanSearch, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AskView, ExportView, MapView } from "../components/Extras";
import { InsightsView } from "../components/Insights";
import { LeadDrawer, LeadsView } from "../components/Leads";
import { Shell as ShellPage } from "../components/Layout";
import { ErrorBox, Skeleton, Toast, useToast } from "../components/ui";
import { api, ApiError, type Analysis, type ReviewState } from "../lib/api";

interface Ev { stage: string; message: string; progress: number }
const STAGES = [
  { key: "retrieving", label: "Searching the collection", icon: ScanSearch },
  { key: "comparing", label: "Comparing leads with Gemma 4", icon: Cpu },
  { key: "synthesizing", label: "Writing insights", icon: Sparkles },
];

function Progress({ events }: { events: Ev[] }) {
  const last = events[events.length - 1];
  const reached = (k: string) => events.some((e) => e.stage === k || (k === "retrieving" && e.stage === "retrieved"));
  const current = last?.stage === "retrieved" ? "comparing" : last?.stage;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="relative h-10 w-10"><div className="absolute inset-0 animate-spin-slow rounded-full bg-gradient-to-tr from-brand-600 via-violet-500 to-fuchsia-400 opacity-80 blur-[1px]" /><div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-white dark:bg-[#0E1428]"><Sparkles size={16} className="text-brand-600" /></div></div>
            <div><div className="font-bold">Analysing your proposal</div><div className="text-sm text-ink-mute" aria-live="polite">{last?.message ?? "Starting…"}</div></div></div>
          <div className="font-mono text-sm font-semibold text-brand-600">{Math.round((last?.progress ?? 0) * 100)}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-500" animate={{ width: `${Math.max(4, (last?.progress ?? 0) * 100)}%` }} transition={{ ease: "easeOut" }} />
        </div>
        <ol className="mt-6 space-y-3">
          {STAGES.map((s) => {
            const done = reached(s.key) && current !== s.key;
            const active = current === s.key;
            return (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span className={clsx("flex h-7 w-7 items-center justify-center rounded-full", done ? "bg-emerald-500 text-white" : active ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200" : "bg-slate-100 text-slate-400 dark:bg-white/10")}>
                  {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <s.icon size={14} />}</span>
                <span className={clsx(done || active ? "font-medium" : "text-ink-mute")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card space-y-3 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5" /><Skeleton className="h-12" /></div>)}</div>
    </div>
  );
}

const TABS = [
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "leads", label: "Leads", icon: ScanSearch },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "ask", label: "Ask the evidence", icon: Bot },
  { key: "export", label: "Review & export", icon: Download },
] as const;

export default function AnalysisPage() {
  const { id = "" } = useParams();
  return <AnalysisBody id={id} />;
}

function Bare({ children }: { children: React.ReactNode; step?: number }) {
  return <div>{children}</div>;
}

export function AnalysisBody({ id, embedded = false, onRerun }: { id: string; embedded?: boolean; onRerun?: () => void }) {
  const Shell = embedded ? Bare : ShellPage;
  const nav = useNavigate();
  const [a, setA] = useState<Analysis | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("insights");
  const [openLead, setOpenLead] = useState<string | null>(null);
  const { msg, show } = useToast();
  const esRef = useRef<EventSource | null>(null);

  const load = () => api.analysis(id).then(setA).catch(setError);
  useEffect(() => {
    setA(null); setEvents([]); setError(null);
    api.analysis(id).then((r) => {
      if (r.status !== "running") { setA(r); return; }
      const es = new EventSource(`/api/analyses/${id}/events`);
      esRef.current = es;
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as Ev;
        setEvents((x) => [...x, e]);
        if (e.stage === "done" || e.stage === "error") { es.close(); setTimeout(load, 200); }
      };
      es.onerror = () => { es.close(); setTimeout(load, 1500); };
    }).catch(setError);
    return () => esRef.current?.close();
  }, [id]); // eslint-disable-line

  const review = async (leadId: string, state: ReviewState, note = "") => {
    if (!a) return;
    setA({ ...a, leads: a.leads.map((l) => (l.item.id === leadId ? { ...l, review: state, note } : l)) });
    try { await api.review(a.id, leadId, state, note); show(state === "unreviewed" ? "Review cleared" : `Marked as ${state.replace("_", " ")}`); }
    catch (e) { setError(e as ApiError); }
  };
  const open = (lid: string) => setOpenLead(lid);

  if (error) return <Shell step={2}><div className="mx-auto max-w-2xl"><ErrorBox error={error} onRetry={() => { setError(null); load(); }} /></div></Shell>;
  if (!a || a.status === "running") return <Shell step={2}><Progress events={events} /></Shell>;
  if (a.status === "error") return <Shell step={2}><div className="mx-auto max-w-2xl space-y-4"><ErrorBox error={{ message: "The analysis failed", hint: a.error }} /><button className="btn-primary" onClick={() => nav("/brief")}><RotateCcw size={15} /> Back to brief</button></div></Shell>;

  const lead = a.leads.find((l) => l.item.id === openLead) || null;
  return (
    <Shell step={tab === "leads" ? 2 : 3}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label mb-1">Analysis</div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{a.brief.title || "Untitled proposal"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="chip bg-white ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10"><Database size={12} /> {a.collection} · {a.searched} items searched</span>
            <span className="chip bg-white ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10" title="Embedding model used for semantic retrieval"><ScanSearch size={12} /> {a.embedder}</span>
            {a.ai_mode === "gemma" ? <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200"><Cpu size={12} /> {a.model}</span>
              : <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300">Retrieval only: AI comparison offline</span>}
            {a.timings.total_s && <span className="text-ink-mute">⚡ {a.timings.total_s}s</span>}
          </div>
        </div>
        <button className="btn-outline" onClick={() => (onRerun ? onRerun() : nav("/brief"))}><RotateCcw size={15} /> {onRerun ? "Re-run" : "Edit brief & re-run"}</button>
      </div>

      <div className={clsx("glass sticky z-20 -mx-4 mb-6 overflow-x-auto border-b border-slate-200/70 px-4 dark:border-white/10 sm:mx-0 sm:rounded-2xl sm:border", embedded ? "top-[66px]" : "top-[61px]")}>
        <div className="flex min-w-max gap-1 py-1.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={clsx("relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition", tab === t.key ? "text-brand-700 dark:text-white" : "text-ink-mute hover:text-ink dark:hover:text-white")}>
              {tab === t.key && <motion.span layoutId="tab" className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-white/10" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
              <t.icon size={15} className="relative" /><span className="relative">{t.label}</span>
              {t.key === "leads" && <span className="relative rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{a.leads.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === "insights" && <InsightsView a={a} onOpenLead={open} toast={show} />}
      {tab === "leads" && <LeadsView analysis={a} onReview={review} />}
      {tab === "map" && <MapView a={a} onOpenLead={open} />}
      {tab === "ask" && <AskView a={a} onOpenLead={open} />}
      {tab === "export" && <ExportView a={a} toast={show} />}

      {tab !== "leads" && <LeadDrawer lead={lead} analysis={a} onClose={() => setOpenLead(null)} onReview={(s, n) => lead && review(lead.item.id, s, n)} />}
      <Toast msg={msg} />
    </Shell>
  );
}
