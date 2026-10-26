import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Compass, Cpu, Database, Files, GitBranch, Moon, Paperclip, Rocket, ShieldCheck, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorBox } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/store";
import { ws } from "../lib/ws";
import { Backdrop, MODULES } from "./Workspace";

const PLACEHOLDERS = [
  "An offline Android app that detects crop diseases from leaf photos and gives voice advice in Telugu…",
  "A campus assistant that answers student questions from official PDFs with page citations…",
  "A tool that analyses citizen complaints, groups duplicates and maps recurring hotspots…",
  "A study app that turns lecture slides into flashcards and adaptive quizzes…",
];
const QUICK = ["AI resume screener that explains its ranking", "Sign-language to speech translator on a phone", "Smart traffic signal timing from CCTV feeds"];

function Typing() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const full = PLACEHOLDERS[i];
    const t = setTimeout(() => { if (n < full.length) setN(n + 2); else { setTimeout(() => { setI((i + 1) % PLACEHOLDERS.length); setN(0); }, 1600); } }, n < full.length ? 28 : 0);
    return () => clearTimeout(t);
  }, [n, i]);
  return <>{PLACEHOLDERS[i].slice(0, n)}<span className="animate-pulse">▍</span></>;
}

const LAUNCH_STEPS = ["Reading your idea with Gemma 4", "Extracting problem, users and contributions", "Writing search queries for papers, patents and GitHub", "Preparing your workspace"];

export default function Landing() {
  const nav = useNavigate();
  const { dark, setDark, health } = useApp();
  const [idea, setIdea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [repo, setRepo] = useState("");
  const [launching, setLaunching] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof ws.list>>>([]);
  const [samples, setSamples] = useState<{ id: string; title: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { ws.list().then(setProjects).catch(() => {}); api.samples().then(setSamples).catch(() => {}); }, []);
  useEffect(() => { if (!launching) return; const t = setInterval(() => setStep((s) => Math.min(s + 1, LAUNCH_STEPS.length - 1)), 2300); return () => clearInterval(t); }, [launching]);

  const launch = async (fd: FormData, then = "overview", q = "") => {
    setLaunching(true); setStep(0); setError(null);
    try { const p = await ws.create(fd); nav(`/p/${p.id}/${then}${q}`); } catch (e) { setError(e as ApiError); setLaunching(false); }
  };
  const go = () => { const fd = new FormData(); if (file) fd.append("file", file); else fd.append("idea", idea); launch(fd); };
  const goSample = (id: string) => { const fd = new FormData(); fd.append("sample", id); launch(fd); };
  const goQuick = (t: string) => { const fd = new FormData(); fd.append("idea", t); launch(fd); };
  const goRepo = () => {
    const fd = new FormData(); fd.append("idea", `Understand and contribute to the open-source repository ${repo}. Goal: set it up locally, learn its architecture and make a first contribution.`);
    fd.append("name", `Onboarding: ${repo.replace(/^https?:\/\/github.com\//, "")}`);
    launch(fd, "onboarding", `?url=${encodeURIComponent(repo)}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Backdrop />
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-5 sm:px-8">
        <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-glow" />
        <span className="text-lg font-extrabold tracking-tight">IdeaForge <span className="gradient-text">AI</span></span>
        <nav className="ml-6 hidden gap-1 md:flex">
          <Link to="/collection" className="btn-ghost !py-1.5 text-sm"><Database size={15} /> Collection</Link>
          <Link to="/batch" className="btn-ghost !py-1.5 text-sm"><Files size={15} /> Batch compare</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className={clsx("pill", health?.ai.available ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-amber-400/40 text-amber-600")}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", health?.ai.available ? "animate-pulse bg-emerald-400" : "bg-amber-400")} /><Cpu size={11} /> {health?.ai.available ? "Gemma 4 online" : "AI offline"}</span>
          <button className="btn-ghost !p-2" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        {/* hero */}
        <section className="pt-10 text-center sm:pt-16">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="pill mx-auto border-brand-300/40 bg-brand-500/10 text-brand-700 dark:text-brand-200">
            <Sparkles size={12} /> Research → GitHub → Novelty → Architecture → Onboarding · powered by Gemma 4</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-auto mt-6 max-w-4xl text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Know what exists.<br /><span className="bg-gradient-to-r from-cyan-400 via-brand-500 to-fuchsia-500 bg-clip-text text-transparent">Build what's new.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mx-auto mt-5 max-w-2xl text-base text-ink-soft dark:text-slate-300 sm:text-lg">
            Describe your idea once. IdeaForge finds related papers, patents and GitHub projects, explains every overlap with verified evidence, and turns it into an architecture, a build plan and a repo you can actually contribute to.
          </motion.p>

          {/* composer */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="relative mx-auto mt-10 max-w-3xl">
            <div className="absolute -inset-[2px] rounded-[26px] bg-gradient-to-r from-cyan-400 via-brand-500 to-fuchsia-500 opacity-80 blur-[3px]" />
            <div className="relative rounded-3xl bg-white p-3 text-left shadow-2xl dark:bg-[#0B1022]">
              <div className="relative">
                <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} aria-label="Describe your idea"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && (idea.trim().length > 20 || file)) go(); }}
                  className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[15px] leading-relaxed placeholder-transparent focus:outline-none" placeholder="Describe your idea" />
                {!idea && <div className="pointer-events-none absolute left-4 top-3 text-[15px] leading-relaxed text-ink-mute"><Typing /></div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-2 pt-3 dark:border-white/[.06]">
                <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file ? <span className="chip bg-brand-500/10 py-1 text-brand-700 dark:text-brand-200"><Paperclip size={12} />{file.name}<button onClick={() => setFile(null)} aria-label="Remove file"><X size={12} /></button></span>
                  : <button className="btn-ghost !py-1.5 text-xs" onClick={() => fileRef.current?.click()}><Paperclip size={14} /> Attach proposal (PDF/DOCX)</button>}
                <span className="hidden text-[11px] text-ink-mute sm:inline">Diagrams in your file are read by Gemma 4 · <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span></span>
                <button className="btn-primary ml-auto px-5" onClick={go} disabled={launching || (!file && idea.trim().length < 20)}><Rocket size={16} /> Launch workspace</button>
              </div>
            </div>
          </motion.div>
          <div className="mx-auto mt-4 max-w-3xl"><ErrorBox error={error} /></div>

          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2">
            {samples.map((s) => <button key={s.id} onClick={() => goSample(s.id)} disabled={launching} className="chip border border-slate-200 bg-white/70 py-1.5 backdrop-blur hover:border-brand-400 dark:border-white/10 dark:bg-white/5">📄 {s.title.split(":")[0]}</button>)}
            {QUICK.map((q) => <button key={q} onClick={() => goQuick(q)} disabled={launching} className="chip border border-slate-200 bg-white/70 py-1.5 backdrop-blur hover:border-brand-400 dark:border-white/10 dark:bg-white/5">💡 {q}</button>)}
          </div>

          <form className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/60 p-1.5 pl-4 backdrop-blur dark:border-white/10 dark:bg-white/[.04]" onSubmit={(e) => { e.preventDefault(); repo.trim() && goRepo(); }}>
            <GitBranch size={16} className="text-amber-500" /><input value={repo} onChange={(e) => setRepo(e.target.value)} className="flex-1 bg-transparent py-2 text-sm focus:outline-none" placeholder="…or paste a GitHub repo to onboard: github.com/owner/repo" />
            <button className="btn-outline !py-2 text-xs" disabled={!repo.trim() || launching}><Compass size={14} /> Onboard</button>
          </form>

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-mute">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-500" /> Bounded, inspectable collections</span>
            <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-emerald-500" /> Quotes verified word-for-word</span>
            <span className="flex items-center gap-1.5"><Cpu size={14} className="text-violet-500" /> Gemma 4 + open-weight models · MIT</span>
          </div>
        </section>

        {/* modules bento */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Six dashboards. One shared evidence library.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-ink-mute">Every module reads the same project brief and passes its findings to the next, so research informs architecture and repositories flow into onboarding.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.filter((m) => ["research", "github", "novelty", "architect", "onboarding", "evaluation"].includes(m.key)).map((m, i) => (
              <motion.div key={m.key} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.06 }}
                className={clsx("glass-card glass-hover group relative overflow-hidden p-6", i === 0 && "lg:col-span-2")}>
                <div className={clsx("pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition group-hover:opacity-40", m.color)} />
                <div className={clsx("icon-tile bg-gradient-to-br", m.color)}><m.icon size={19} /></div>
                <div className="mt-4 text-lg font-bold">{m.label}</div>
                <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{({
                  research: "Papers from OpenAlex and arXiv, patents from PatentsView plus Google Patents, Lens and Espacenet links. Grounded summaries, comparison matrix, timeline and evidence-backed research gaps.",
                  github: "Existing repositories classified as direct match, building block or inspiration, each with an AI summary. If nothing exists, you get a step-by-step workflow to build it from reusable parts.",
                  novelty: "The core problem statement: each claimed contribution compared aspect by aspect against a bounded collection, with verified quotes and three honest indicators.",
                  architect: "A stack chosen for your team's constraints, architecture and ER diagrams, API catalogue, phased roadmap, tests and deployment checklist.",
                  onboarding: "Clone any public repo safely: file map, architecture, a setup guide drawn from real files, env vars, routes, tests, starter tasks and code Q&A with line references.",
                  evaluation: "Measure answer quality: faithfulness, relevance, context precision and recall, and citation accuracy, comparing retrieval configs side by side.",
                } as Record<string, string>)[m.key]}</p>
              </motion.div>))}
          </div>
        </section>

        {projects.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-lg font-bold">Your projects</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 9).map((p) => (
              <Link key={p.id} to={`/p/${p.id}/overview`} className="glass-card glass-hover group block p-5">
                <div className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-300">{p.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-mute">{p.idea}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-mute"><span>{new Date(p.created_at).toLocaleString()}</span><ArrowRight size={14} className="transition group-hover:translate-x-1" /></div>
              </Link>))}</div>
          </section>)}
      </main>
      <footer className="border-t border-slate-200/60 py-6 text-center text-xs text-ink-mute dark:border-white/[.06]">
        IdeaForge AI · Hacktoberfest Hack Day Amaravati × AIBPT Club VIT-AP · Gemma 4 + EmbeddingGemma · MIT · Results are leads for human review, not legal or novelty opinions.
      </footer>

      <AnimatePresence>
        {launching && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-card gradient-border w-full max-w-md bg-white p-8 dark:bg-[#0B1022]">
              <div className="relative mx-auto h-20 w-20"><div className="absolute inset-0 animate-spin-slow rounded-full bg-gradient-to-tr from-cyan-400 via-brand-500 to-fuchsia-500 blur-[3px]" />
                <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-white dark:bg-[#0B1022]"><Sparkles className="text-brand-500" /></div></div>
              <div className="mt-6 space-y-3">{LAUNCH_STEPS.map((s, i) => (
                <div key={s} className={clsx("flex items-center gap-3 text-sm transition", i > step && "opacity-35")}>
                  <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-500 text-white" : "bg-slate-200 dark:bg-white/10")}>{i < step ? "✓" : i + 1}</span>{s}</div>))}</div>
            </motion.div>
          </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
