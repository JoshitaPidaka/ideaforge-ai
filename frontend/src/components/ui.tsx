import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, BookOpen, Code2, Info, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Level } from "../lib/api";

export const LEVEL_STYLE: Record<string, { text: string; bg: string; bar: string; label: string }> = {
  high: { text: "text-hi", bg: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30", bar: "bg-hi", label: "High overlap" },
  medium: { text: "text-mid", bg: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30", bar: "bg-mid", label: "Medium overlap" },
  low: { text: "text-lo", bg: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", bar: "bg-lo", label: "Low overlap" },
};

export function LevelBadge({ level, children }: { level: Level | string; children?: ReactNode }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.low;
  const dot = level === "high" ? "●●●" : level === "medium" ? "●●○" : "●○○";
  return <span className={clsx("chip", s.bg)}><span className="tracking-[-2px] text-[9px]" aria-hidden>{dot}</span> {children ?? s.label}</span>;
}

export function OverlapMeter({ level }: { level: Level | string }) {
  const n = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.low;
  return (
    <div className="flex gap-1" role="img" aria-label={s.label}>
      {[0, 1, 2].map((i) => <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.08 }}
        className={clsx("h-1.5 w-6 origin-left rounded-full", i < n ? s.bar : "bg-slate-200 dark:bg-white/10")} />)}
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return type === "paper"
    ? <span className="chip bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30"><BookOpen size={12} /> Paper</span>
    : <span className="chip bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30"><Code2 size={12} /> Project</span>;
}

export function Verified({ ok }: { ok: boolean }) {
  return ok
    ? <span className="chip bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" title="This quote was found word-for-word in the source"><BadgeCheck size={12} /> Verified quote</span>
    : <span className="chip bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400" title="Could not find this quote in the source text; it is ignored in scoring"><AlertTriangle size={12} /> Unverified</span>;
}

export function Quote({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <blockquote className={clsx("mt-1.5 rounded-lg border-l-[3px] px-3 py-1.5 font-mono text-[12px] leading-relaxed",
      ok ? "border-emerald-500 bg-emerald-50/60 text-emerald-900 dark:bg-emerald-500/5 dark:text-emerald-200" : "border-slate-300 bg-slate-50 text-slate-500 line-through decoration-slate-300 dark:bg-white/5")}>
      “{text}”
    </blockquote>
  );
}

const GLOSSARY: Record<string, string> = {
  "semantic retrieval": "Finding items with similar meaning, even when they use different words.",
  "bounded collection": "A fixed, known set of papers and projects. We only search inside it, so you always know what was checked.",
  "lead": "A possibly related item for you to review. Not proof of anything by itself.",
  "verified quote": "We checked that this exact sentence really appears in the source.",
  "overlap": "How much existing work already does what your contribution claims.",
  "coverage": "How much was searched: the number of items and the kinds of sources.",
  "confidence": "How solid the evidence is: mostly how many quotes were verified.",
  "contribution": "One specific thing your project claims to build or do differently.",
};
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  return <span className="term" title={GLOSSARY[k.toLowerCase()] || ""}>{children ?? k}</span>;
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-modal="true" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0E1428]"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div className="min-w-0 flex-1">{title}</div>
              <button className="btn-ghost !p-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-brand-500">{icon ?? <Info />}</div>
      <div className="font-semibold">{title}</div>
      <div className="max-w-md text-sm text-ink-mute dark:text-slate-400">{children}</div>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: { message: string; hint?: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1"><div className="font-medium">{error.message}</div>{error.hint && <div className="opacity-80">{error.hint}</div>}</div>
      {onRetry && <button className="btn-outline !py-1" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-ink">{msg}</motion.div>}
    </AnimatePresence>
  );
}
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); };
  return { msg, show };
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Section({ title, icon, children, right, sub }: { title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
          {sub && <p className="text-sm text-ink-mute dark:text-slate-400">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
