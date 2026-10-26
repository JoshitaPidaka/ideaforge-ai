import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Code2, Copy, ExternalLink, FileText, Loader2, ScrollText, WifiOff } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { SourceStatus } from "../lib/ws";

/* Mermaid diagram with graceful fallback to code. */
export function Mermaid({ code, className }: { code: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    if (!code?.trim()) return;
    (async () => {
      try {
        const m = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        m.initialize({ startOnLoad: false, theme: dark ? "dark" : "default", securityLevel: "strict",
          flowchart: { useMaxWidth: false, nodeSpacing: 40, rankSpacing: 55, padding: 12 }, er: { useMaxWidth: false },
          themeVariables: dark ? { primaryColor: "#312E81", primaryTextColor: "#E0E7FF", primaryBorderColor: "#818CF8", lineColor: "#A5B4FC", fontFamily: "Inter", fontSize: "15px" } : { fontFamily: "Inter", fontSize: "15px" } });
        const { svg } = await m.render(`m${id}${Math.random().toString(36).slice(2, 7)}`, code.replace(/\\n/g, "\n"));
        if (alive) { setSvg(svg); setErr(""); }
      } catch (e: any) { if (alive) setErr(String(e?.message || e).slice(0, 160)); }
    })();
    return () => { alive = false; };
  }, [code, id]);
  if (err) return (
    <div className={clsx("rounded-xl border border-amber-300/50 bg-amber-50/50 p-3 text-xs dark:bg-amber-500/5", className)}>
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle size={13} /> Diagram couldn't render; showing Mermaid source</div>
      <pre className="overflow-x-auto font-mono text-[11px]">{code}</pre>
    </div>
  );
  return svg ? <div className={clsx("mermaid-wrap flex overflow-x-auto py-2 scrollbar-thin [&>svg]:mx-auto [&>svg]:shrink-0", className)} dangerouslySetInnerHTML={{ __html: svg }} />
    : <div className={clsx("flex h-40 items-center justify-center text-sm text-ink-mute", className)}><Loader2 className="mr-2 animate-spin" size={16} /> Drawing diagram…</div>;
}

export function RelevanceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" title="Relevance to your idea (semantic + keyword match). A ranking aid, not a quality score.">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-brand-500 to-violet-500" />
      </div>
      <span className="font-mono text-[11px] text-ink-mute">{pct}</span>
    </div>
  );
}

export function SourceStatusBar({ statuses, fallback }: { statuses: SourceStatus[]; fallback?: boolean }) {
  if (!statuses?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s) => (
        <span key={s.source} title={s.error || s.note} className={clsx("pill", s.ok ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300")}>
          {s.ok ? <CheckCircle2 size={12} /> : <WifiOff size={12} />}{s.source}{s.ok ? ` · ${s.count}` : s.note ? " · needs key" : " · unreachable"}
        </span>
      ))}
      {fallback && <span className="pill border-sky-300/60 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">Showing local bounded collection</span>}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); }}>
      {ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}{label}
    </button>
  );
}

export function Stat({ label, value, icon, tone = "brand", sub }: { label: string; value: ReactNode; icon: ReactNode; tone?: string; sub?: string }) {
  const tones: Record<string, string> = {
    brand: "from-brand-500 to-violet-600", cyan: "from-cyan-500 to-sky-600", emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600", rose: "from-rose-500 to-pink-600", violet: "from-violet-500 to-fuchsia-600",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card flex items-center gap-4 p-4">
      <div className={clsx("icon-tile bg-gradient-to-br", tones[tone])}>{icon}</div>
      <div className="min-w-0"><div className="text-2xl font-extrabold tracking-tight">{value}</div><div className="truncate text-xs text-ink-mute dark:text-slate-400">{label}</div>
        {sub && <div className="truncate text-[11px] text-ink-mute/80">{sub}</div>}</div>
    </motion.div>
  );
}

export function KindIcon({ kind }: { kind: string }) {
  return kind === "patent" ? <ScrollText size={13} /> : kind === "repo" ? <Code2 size={13} /> : <FileText size={13} />;
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300">{children}<ExternalLink size={11} /></a>;
}

export function Label({ children, tone }: { children: ReactNode; tone: "fact" | "ai" | "rec" }) {
  const s = { fact: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300", ai: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200", rec: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200" }[tone];
  return <span className={clsx("chip", s)} title={tone === "fact" ? "Retrieved from the source" : tone === "ai" ? "AI-written summary of the source" : "AI-generated recommendation"}>{children}</span>;
}

export function Busy({ label, steps }: { label: string; steps?: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (!steps?.length) return; const t = setInterval(() => setI((x) => (x + 1) % steps.length), 2200); return () => clearInterval(t); }, [steps]);
  return (
    <div className="glass-card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="relative h-14 w-14"><div className="absolute inset-0 animate-spin-slow rounded-full bg-gradient-to-tr from-cyan-400 via-brand-500 to-fuchsia-500 blur-[2px]" />
        <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-white dark:bg-[#0B1022]"><Loader2 className="animate-spin text-brand-500" size={20} /></div></div>
      <div className="font-semibold">{label}</div>
      {steps && <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-ink-mute dark:text-slate-400">{steps[i]}</motion.div>}
    </div>
  );
}
