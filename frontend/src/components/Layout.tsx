import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Cpu, Database, Github, HelpCircle, Layers, Moon, Sparkles, Sun } from "lucide-react";
import { startTour } from "./Tour";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useApp } from "../lib/store";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="IdeaForge AI home">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg shadow-glow" />
      <span className="text-[17px] font-extrabold tracking-tight">IdeaForge <span className="gradient-text">AI</span></span>
    </Link>
  );
}

function AiPill() {
  const { health } = useApp();
  if (!health) return <span className="chip bg-slate-100 text-slate-500 dark:bg-white/10">Connecting…</span>;
  return health.ai.available ? (
    <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" title={`Model: ${health.ai.model}`}>
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
      <Cpu size={12} /> Gemma 4
    </span>
  ) : (
    <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300" title={health.ai.error}>
      <Cpu size={12} /> AI offline: search only
    </span>
  );
}

export function TopBar() {
  const { health, collection, setCollection, simple, setSimple, dark, setDark } = useApp();
  const cols = health?.collections ?? [];
  const cur = cols.find((c) => c.name === collection);
  const loc = useLocation();
  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-200/70 dark:border-white/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {[["/", "Analyse"], ["/collection", "Collection"], ["/batch", "Batch compare"]].map(([to, l]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => clsx("rounded-lg px-3 py-1.5 text-sm font-medium transition",
              isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-ink-mute hover:text-ink dark:text-slate-400 dark:hover:text-white")}>{l}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AiPill />
          <label data-tour="collection" className="chip cursor-pointer bg-white py-1 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10" title="The bounded collection searched by IdeaForge">
            <Database size={13} className="text-brand-600" />
            <select aria-label="Collection" className="bg-transparent text-xs font-semibold focus:outline-none" value={collection} onChange={(e) => setCollection(e.target.value)}>
              {cols.length === 0 && <option value="seed">seed</option>}
              {cols.map((c) => <option key={c.name} value={c.name}>{c.name} · {c.items} items</option>)}
            </select>
            {cur && <span className="sr-only">{cur.items} items</span>}
          </label>
          <button data-tour="simple" onClick={() => setSimple(!simple)} aria-pressed={simple}
            className={clsx("chip py-1 ring-1 transition", simple ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-slate-200 dark:bg-white/5 dark:ring-white/10")}
            title="Rewrite explanations in plain, beginner-friendly language">
            <Sparkles size={13} /> Explain simply
          </button>
          {loc.pathname === "/" && <button className="btn-ghost !p-2" onClick={startTour} aria-label="Take the tour" title="Take the tour"><HelpCircle size={17} /></button>}
          <button className="btn-ghost !p-2" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <a className="btn-ghost !p-2" href="https://github.com" target="_blank" rel="noreferrer" aria-label="Source code"><Github size={17} /></a>
        </div>
        <nav className="flex w-full gap-1 md:hidden">
          {[["/", "Analyse"], ["/collection", "Collection"], ["/batch", "Batch"]].map(([to, l]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => clsx("flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold", isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-ink-mute")}>{l}</NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

const STEPS = ["Proposal", "Brief", "Leads", "Insights"];
export function Stepper({ step }: { step: number }) {
  return (
    <ol className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-5" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
          <div className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
            i < step ? "bg-gradient-to-br from-brand-600 to-violet-600 text-white" : i === step ? "bg-white text-brand-700 ring-2 ring-brand-500 dark:bg-transparent dark:text-brand-200" : "bg-slate-200 text-slate-500 dark:bg-white/10")}
            aria-current={i === step ? "step" : undefined}>
            {i < step ? <Check size={15} /> : i + 1}
          </div>
          <span className={clsx("hidden text-sm font-semibold sm:block", i <= step ? "text-ink dark:text-white" : "text-ink-mute")}>{s}</span>
          {i < STEPS.length - 1 && (
            <div className="relative mx-1 h-0.5 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
              <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-600 to-violet-600" initial={{ width: 0 }} animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Shell({ children, step }: { children: ReactNode; step?: number }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen">
      <TopBar />
      {step !== undefined && <Stepper step={step} />}
      <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">{children}</motion.main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-ink-mute dark:border-white/10 dark:text-slate-500">
        <Layers size={12} className="mr-1 inline" /> IdeaForge AI · Built with Gemma 4 + EmbeddingGemma (open-weight) · MIT licensed ·
        Results are <b>leads for human review</b>, not proof of novelty.
      </footer>
    </div>
  );
}
