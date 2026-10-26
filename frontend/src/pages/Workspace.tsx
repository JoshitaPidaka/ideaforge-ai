import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenText, Calendar, ChevronDown, Compass, Cpu, Crosshair, Database, Files, FlaskConical, Github, Home, LayoutDashboard, Menu, Moon, Radar, RefreshCw, Search,
  ShieldCheck, Sun, Waypoints, X,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { Busy } from "../components/kit";
import { ErrorBox } from "../components/ui";
import { ApiError } from "../lib/api";
import { useApp } from "../lib/store";
import { ws, type Project } from "../lib/ws";
import ArchitectView from "./modules/Architect";
import EvaluationView from "./modules/Evaluation";
import GithubView from "./modules/Github";
import InvestigateView from "./modules/Investigate";
import ModelCardView from "./modules/ModelCard";
import NoveltyView from "./modules/Novelty";
import OnboardingView from "./modules/Onboarding";
import OverviewView from "./modules/Overview";
import ResearchView from "./modules/Research";
import TrustView from "./modules/Trust";

export const MODULES = [
  { key: "overview", group: "project", label: "Overview", icon: LayoutDashboard, color: "from-slate-500 to-slate-700", desc: "Briefing, KPIs and next steps",
    eyebrow: "Project briefing", question: "What already exists, and what should we build first?", sub: "One idea, every source. The briefing is written from the evidence your project has collected so far." },
  { key: "investigate", group: "project", label: "Investigate first", icon: Crosshair, color: "from-fuchsia-500 to-pink-600", desc: "Claims ranked by overlap",
    eyebrow: "Investigate first", question: "Which of our claims already exist, and which look new?", sub: "Contributions ranked by verified overlap with prior work, with the evidence count and confidence for each. Treat them as leads for human review." },
  { key: "research", group: "project", label: "Papers & patents", icon: BookOpenText, color: "from-sky-500 to-cyan-500", desc: "Research intelligence",
    eyebrow: "Research intelligence · live sources", question: "What has already been published or patented?", sub: "Papers from OpenAlex and arXiv and patents from PatentsView, ranked by relevance to your idea. Every summary is grounded in the retrieved abstract." },
  { key: "github", group: "project", label: "GitHub intelligence", icon: Github, color: "from-violet-500 to-fuchsia-500", desc: "Repos, AI summaries, build plan",
    eyebrow: "GitHub intelligence", question: "Has someone already built this, and what can we reuse?", sub: "Repositories classified as direct match, building block or inspiration. If nothing exists, a workflow to build it from reusable parts." },
  { key: "novelty", group: "project", label: "Novelty report", icon: Radar, color: "from-rose-500 to-orange-500", desc: "Prior-art overlap with evidence",
    eyebrow: "Project report novelty & prior-art explorer", question: "Where exactly does our idea overlap with prior work?", sub: "Semantic retrieval over a bounded collection, structured comparison on six aspects, and evidence-grounded summaries with word-for-word verified quotes." },
  { key: "architect", group: "project", label: "Project architect", icon: Waypoints, color: "from-emerald-500 to-teal-500", desc: "Stack, architecture, roadmap",
    eyebrow: "AI project architect", question: "How should we build it with our team and time?", sub: "A stack reasoned from your constraints, architecture and data model, APIs, a phased roadmap, tests and deployment." },
  { key: "onboarding", group: "project", label: "Repo onboarding", icon: Compass, color: "from-amber-500 to-orange-500", desc: "Understand any repository",
    eyebrow: "Repository onboarding assistant", question: "How do I get this repository running and make a first contribution?", sub: "Key folders, setup steps traced to real files, test commands and beginner tasks. Ask questions and get file and line references." },
  { key: "trust", group: "shared", label: "Data trust centre", icon: ShieldCheck, color: "from-cyan-500 to-blue-600", desc: "Lineage & quality checks",
    eyebrow: "Data trust centre", question: "What the evidence can and cannot support", sub: "Every source, every fallback and every quality check that affects what this project shows. Nothing is hidden or simulated." },
  { key: "model", group: "shared", label: "Model card", icon: Cpu, color: "from-indigo-500 to-violet-600", desc: "Models, retrieval, metrics",
    eyebrow: "Model card", question: "Which models answer, and how well do they do it?", sub: "The open-weight models, retrieval settings, grounding rules and measured quality behind every answer." },
  { key: "evaluation", group: "shared", label: "RAG evaluation", icon: FlaskConical, color: "from-pink-500 to-rose-500", desc: "Measure answer quality",
    eyebrow: "RAG evaluation workbench", question: "Are the AI answers faithful to the evidence?", sub: "Faithfulness, relevance, context precision and recall, and citation accuracy, run on a question set and compared across retrieval settings." },
] as const;

interface Ctx { project: Project; reload: () => Promise<void>; go: (module: string, q?: string) => void }
const PC = createContext<Ctx>(null as any);
export const useProject = () => useContext(PC);

export function Backdrop() {
  return <><div className="aurora"><span /></div><div className="noise" /></>;
}

function Sidebar({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const has = (k: string) => (k === "research" ? project.counts.research : k === "github" ? project.counts.github : k === "novelty" || k === "investigate" ? project.novelty_analysis
    : k === "architect" ? project.artifacts.includes("architect") : k === "onboarding" ? project.artifacts.includes("onboarding_scan") : false);
  const item = (m: (typeof MODULES)[number]) => (
    <NavLink key={m.key} to={`/p/${project.id}/${m.key}`} onClick={onClose}
      className={({ isActive }) => clsx("group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] transition",
        isActive ? "bg-gradient-to-r from-brand-500/15 to-violet-500/5 font-semibold text-ink ring-1 ring-brand-400/25 dark:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-ink dark:text-slate-400 dark:hover:bg-white/[.04] dark:hover:text-slate-100")}>
      <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md transition group-hover:scale-105", m.color)}><m.icon size={14} /></span><span className="flex-1 truncate">{m.label}</span>
      {has(m.key) && <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" title="Has results" />}
    </NavLink>
  );
  return (
    <aside className={clsx("fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-slate-200 bg-white transition-transform dark:border-white/[.07] dark:bg-[#080C1C]/80 backdrop-blur-2xl lg:translate-x-0",
      open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg shadow-glow" />
        <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold leading-tight">IdeaForge <span className="gradient-text">AI</span></div><div className="truncate text-[10.5px] text-ink-mute">Novelty & Prior-Art · Hack Day</div></div>
        <button className="btn-ghost !p-1 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={16} /></button>
      </div>
      <div className="mx-3 mb-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-brand-50 to-violet-50 px-3 py-2 dark:border-white/10 dark:from-brand-500/10 dark:to-violet-500/5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">Project workspace</div>
        <div className="mt-0.5 line-clamp-2 text-[12.5px] font-semibold leading-snug">{project.title}</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {MODULES.filter((m) => m.group === "project").map(item)}
        <div className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-ink-mute">Shared</div>
        {MODULES.filter((m) => m.group === "shared").map(item)}
        <Link to="/collection" className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[.04]"><Database size={15} /> Bounded collection</Link>
        <Link to="/batch" className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[.04]"><Files size={15} /> Batch compare</Link>
      </nav>
      <div className="border-t border-slate-200 p-3 text-[10.5px] leading-relaxed text-ink-mute dark:border-white/[.07]">
        <b className="text-slate-500 dark:text-slate-400">Leads for human review.</b> Similarity is not proof of novelty, plagiarism or patentability. Sources and fallbacks are listed in the Data trust centre.
      </div>
    </aside>
  );
}

function Palette({ project, onClose }: { project: Project; onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => { ws.list().then(setProjects).catch(() => {}); }, []);
  const items = useMemo(() => [
    ...MODULES.map((m) => ({ k: `m-${m.key}`, label: m.label, sub: m.question, icon: <m.icon size={15} />, go: () => nav(`/p/${project.id}/${m.key}`) })),
    ...projects.filter((p) => p.id !== project.id).map((p) => ({ k: `p-${p.id}`, label: p.title, sub: "Switch project", icon: <Home size={15} />, go: () => nav(`/p/${p.id}/overview`) })),
    { k: "new", label: "New project", sub: "Start from a new idea", icon: <Home size={15} />, go: () => nav("/") },
  ].filter((x) => !q || (x.label + x.sub).toLowerCase().includes(q.toLowerCase())), [q, projects, project.id, nav]);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-white/[.04]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-white/[.08]"><Search size={15} className="text-ink-mute" />
          <input autoFocus className="flex-1 bg-transparent py-3 text-sm focus:outline-none" placeholder="Search pages and projects…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && items[0]) { items[0].go(); onClose(); } if (e.key === "Escape") onClose(); }} /><span className="kbd">Esc</span></div>
        <div className="max-h-80 overflow-y-auto p-1.5">{items.map((x) => (
          <button key={x.k} onClick={() => { x.go(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-500/10">
            <span className="text-brand-600 dark:text-brand-400">{x.icon}</span><span className="min-w-0"><span className="block text-[13px] font-medium">{x.label}</span><span className="block truncate text-[11px] text-ink-mute">{x.sub}</span></span></button>))}</div>
      </motion.div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return <span className="pill hidden border-slate-200 text-ink-mute dark:border-white/10 md:inline-flex"><Calendar size={11} /> {now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

export function PageHeader({ eyebrow, title, sub, right, icon, color }: { eyebrow: string; title: string; sub?: string; right?: ReactNode; icon?: ReactNode; color?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex max-w-4xl items-start gap-4">
      {icon && <div className={clsx("mt-1 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow sm:flex", color)}>{icon}</div>}
      <div><div className="eyebrow">{eyebrow}</div><h1 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-ink-mute dark:text-slate-400">{sub}</p>}</div></div>
      {right}
    </div>
  );
}

export default function Workspace() {
  const { id = "", module = "overview" } = useParams();
  const nav = useNavigate();
  const { dark, setDark, health } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const reload = async () => { try { setProject(await ws.get(id)); } catch (e) { setError(e as ApiError); } };
  useEffect(() => { setProject(null); reload(); ws.list().then(setProjects).catch(() => {}); }, [id]); // eslint-disable-line
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);
  const go = (m: string, q?: string) => nav(`/p/${id}/${m}${q ? `?${q}` : ""}`);
  const mod = MODULES.find((m) => m.key === module) ?? MODULES[0];

  let body: ReactNode = null;
  if (project) body = ({ overview: <OverviewView />, investigate: <InvestigateView />, research: <ResearchView />, github: <GithubView />, novelty: <NoveltyView />,
    architect: <ArchitectView />, onboarding: <OnboardingView />, trust: <TrustView />, model: <ModelCardView />, evaluation: <EvaluationView /> } as Record<string, ReactNode>)[mod.key];

  return (
    <div className="min-h-screen">
      <Backdrop />
      {error ? <div className="mx-auto max-w-xl p-10"><ErrorBox error={error} onRetry={reload} /></div> : !project ? <div className="mx-auto max-w-xl p-10"><Busy label="Opening workspace…" /></div> : (
        <PC.Provider value={{ project, reload, go }}>
          <Sidebar project={project} open={menu} onClose={() => setMenu(false)} />
          {menu && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
          <div className="lg:pl-[232px]">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/[.07] dark:bg-[#070B18]/60 backdrop-blur-2xl">
              <div className="flex items-center gap-2 px-4 py-2.5 sm:px-6">
                <button className="btn-ghost !p-1.5 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={17} /></button>
                <label className="relative hidden items-center sm:flex"><mod.icon size={14} className="pointer-events-none absolute left-2.5 text-brand-600 dark:text-brand-400" />
                  <select aria-label="Switch project" value={project.id} onChange={(e) => nav(`/p/${e.target.value}/${mod.key}`)}
                    className="max-w-[230px] appearance-none truncate rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-[12.5px] font-medium dark:border-white/10 dark:bg-white/[.04]">
                    {[{ id: project.id, title: project.title }, ...projects.filter((p) => p.id !== project.id)].map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 text-ink-mute" /></label>
                <button onClick={() => setPalette(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[12.5px] text-ink-mute hover:border-brand-400/50 dark:border-white/10 dark:bg-white/[.04] sm:max-w-xs">
                  <Search size={14} /><span className="flex-1 truncate">Search pages, projects…</span><span className="kbd">⌘K</span></button>
                <div className="ml-auto flex items-center gap-1.5">
                  <Clock />
                  <span className={clsx("pill", health?.ai.available ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-amber-500/30 text-amber-600")} title={health?.ai.error || health?.ai.model}>
                    <span className={clsx("h-1.5 w-1.5 rounded-full", health?.ai.available ? "bg-emerald-400" : "bg-amber-400")} />{health?.ai.available ? `Gemma 4 · ${health.ai.model.match(/(\d+b)/)?.[1]?.toUpperCase() ?? ""}` : "AI offline"}</span>
                  <button className="btn-ghost !p-1.5" onClick={reload} aria-label="Refresh" title="Refresh"><RefreshCw size={15} /></button>
                  <button className="btn-ghost !p-1.5" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
                  <Link to="/" className="btn-ghost !p-1.5" aria-label="All projects" title="All projects"><Home size={15} /></Link>
                </div>
              </div>
            </header>
            <AnimatePresence mode="wait">
              <motion.main key={mod.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                className="mx-auto max-w-[1480px] px-4 pb-20 pt-6 sm:px-6">
                <PageHeader eyebrow={mod.eyebrow} title={mod.question} sub={mod.sub} icon={<mod.icon size={22} />} color={mod.color} />
                {body}
              </motion.main>
            </AnimatePresence>
          </div>
          {palette && <Palette project={project} onClose={() => setPalette(false)} />}
        </PC.Provider>
      )}
    </div>
  );
}
