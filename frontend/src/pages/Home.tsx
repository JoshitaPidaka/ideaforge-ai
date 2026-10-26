import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ClipboardPaste, Clock, FileUp, GitCompare, Loader2, Microscope, ScanSearch, ShieldCheck, Sparkles, Upload, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout";
import { Tour } from "../components/Tour";
import { ErrorBox, LevelBadge, Term } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/store";

const SAMPLE_ICONS = ["🎓", "🏛️", "🌿"];

export default function Home() {
  const nav = useNavigate();
  const { setDraft, health } = useApp();
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [samples, setSamples] = useState<{ id: string; title: string; preview: string }[]>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof api.recent>>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.samples().then(setSamples).catch(() => {}); api.recent().then(setRecent).catch(() => {}); }, []);

  async function submit(fd: FormData, label: string) {
    setBusy(label); setError(null);
    try {
      const p = await api.createProposal(fd);
      setDraft({ proposalId: p.id, name: p.name, preview: p.preview, figures: p.figures, brief: null });
      nav("/brief");
    } catch (e) { setError(e as ApiError); } finally { setBusy(null); }
  }
  const sendFile = (f: File) => { const fd = new FormData(); fd.append("file", f); submit(fd, f.name); };
  const sendText = () => { const fd = new FormData(); fd.append("text", text); submit(fd, "text"); };
  const sendSample = (id: string) => { const fd = new FormData(); fd.append("sample", id); submit(fd, id); };

  return (
    <Shell step={0}>
      {/* hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white px-5 py-12 shadow-soft dark:border-white/10 dark:bg-white/[.03] sm:px-12">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="chip mb-4 bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
            <Sparkles size={12} /> Prior-art explorer powered by Gemma 4
          </motion.span>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Know what exists.<br /><span className="gradient-text">Pitch what's new.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-soft dark:text-slate-300">
            Upload your project proposal. IdeaForge searches a <Term k="bounded collection" /> of papers and projects, explains exactly where they overlap
            with <Term k="verified quote">quoted evidence</Term>, and helps you sharpen what makes your idea different.
          </p>
        </div>

        {/* input card */}
        <div className="relative mx-auto mt-8 max-w-2xl" data-tour="upload">
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500 opacity-70 blur-[2px]" />
          <div className="relative rounded-[20px] bg-white p-2 dark:bg-[#0E1428]">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist">
              {(["upload", "paste"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={clsx("flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
                    tab === t ? "bg-white text-ink shadow-sm dark:bg-white/10 dark:text-white" : "text-ink-mute")}>
                  {t === "upload" ? <><FileUp size={15} /> Upload file</> : <><ClipboardPaste size={15} /> Paste text</>}
                </button>
              ))}
            </div>
            {tab === "upload" ? (
              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) sendFile(f); }}
                onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                className={clsx("mt-2 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition",
                  drag ? "border-brand-500 bg-brand-50/70 dark:bg-brand-500/10" : "border-slate-200 hover:border-brand-400 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5")}>
                <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0])} />
                {busy && busy !== "text" && !samples.some((s) => s.id === busy) ? <Loader2 className="animate-spin text-brand-600" size={34} /> :
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-3 text-white shadow-glow"><Upload size={24} /></motion.div>}
                <div className="text-center">
                  <div className="font-semibold">{busy ? `Reading ${busy}…` : "Drop your proposal here, or click to browse"}</div>
                  <div className="text-xs text-ink-mute">PDF, DOCX, TXT or Markdown · up to 10 MB · diagrams are read by Gemma 4</div>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <textarea className="input min-h-[170px] resize-y" placeholder="Paste your project title and description: problem, users, solution, key features…" value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-mute">{text.trim().split(/\s+/).filter(Boolean).length} words</span>
                  <button className="btn-primary" disabled={text.trim().length < 80 || !!busy} onClick={sendText}>
                    {busy === "text" ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />} Analyse proposal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative mx-auto mt-4 max-w-2xl"><ErrorBox error={error} /></div>

        {/* trust strip */}
        <div className="relative mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-mute dark:text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-600" /> Searches only a bounded collection</span>
          <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-emerald-600" /> Every quote checked word-for-word</span>
          <span className="flex items-center gap-1.5"><UserCheck size={14} className="text-violet-600" /> You review every lead</span>
        </div>
      </section>

      {/* samples */}
      <section className="mt-10" data-tour="samples">
        <div className="mb-3 flex items-end justify-between">
          <div><h2 className="text-lg font-bold">Try a sample proposal</h2><p className="text-sm text-ink-mute dark:text-slate-400">One click, no file needed. Great for a first look.</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {samples.map((s, i) => (
            <motion.button key={s.id} whileHover={{ y: -3 }} onClick={() => sendSample(s.id)} disabled={!!busy}
              className="card group flex flex-col items-start gap-2 p-5 text-left transition hover:shadow-glow">
              <div className="text-2xl">{SAMPLE_ICONS[i % 3]}</div>
              <div className="font-semibold leading-snug">{s.title}</div>
              <div className="line-clamp-3 text-xs text-ink-mute dark:text-slate-400">{s.preview}</div>
              <div className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
                {busy === s.id ? <><Loader2 size={14} className="animate-spin" /> Loading…</> : <>Analyse <ArrowRight size={14} className="transition group-hover:translate-x-1" /></>}
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: <Microscope />, t: "1 · Understand", d: "Gemma 4 reads your proposal, including its diagrams, and lists your claimed contributions." },
            { i: <ScanSearch />, t: "2 · Retrieve", d: "Hybrid semantic + keyword search runs over the bounded collection, once per contribution." },
            { i: <GitCompare />, t: "3 · Compare", d: "Each lead is compared aspect by aspect (problem, method, data, users, platform, outcome) with verified quotes." },
            { i: <Sparkles />, t: "4 · Decide", d: "Overlap, coverage and confidence, plus gaps, differentiation ideas, a pitch line and judge questions." },
          ].map((s, k) => (
            <motion.div key={s.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.07 }} className="card p-5">
              <div className="mb-3 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">{s.i}</div>
              <div className="font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-ink-mute dark:text-slate-400">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* recent */}
      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Clock size={18} /> Recent analyses</h2>
          <div className="card divide-y divide-slate-100 dark:divide-white/5">
            {recent.slice(0, 6).map((r) => (
              <button key={r.id} onClick={() => nav(`/analysis/${r.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-ink-mute">{new Date(r.created_at).toLocaleString()} · {r.leads} leads</div></div>
                {r.overlap && <LevelBadge level={r.overlap} />}
                <ArrowRight size={16} className="text-ink-mute" />
              </button>
            ))}
          </div>
        </section>
      )}
      {health && !health.ai.available && (
        <p className="mt-8 text-center text-xs text-amber-700 dark:text-amber-300">
          Gemma 4 is not connected ({health.ai.error}). Retrieval still works; set <code>GEMINI_API_KEY</code> for AI comparison and summaries.
        </p>
      )}
      <Tour />
    </Shell>
  );
}
