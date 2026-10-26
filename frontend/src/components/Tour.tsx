import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";

const STEPS = [
  { target: "upload", title: "1 · Add your proposal", body: "Drop a PDF/DOCX or paste text. Gemma 4 reads the text and the diagrams in it." },
  { target: "samples", title: "2 · Or try a sample", body: "No file handy? Click a sample proposal to see a full analysis in one click." },
  { target: "collection", title: "3 · The bounded collection", body: "Every search runs only inside this fixed set of papers and projects. You can switch to your own collection." },
  { target: "simple", title: "4 · Explain simply", body: "New to research? Turn this on and every explanation is rewritten in plain language." },
];
const KEY = "tour-done";

export function startTour() { window.dispatchEvent(new Event("ideaforge:tour")); }

export function Tour() {
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const start = () => setI(0);
    window.addEventListener("ideaforge:tour", start);
    let done = false;
    try { done = localStorage.getItem(KEY) === "1"; } catch { /* storage blocked */ }
    const t = !done ? setTimeout(start, 900) : undefined;
    return () => { window.removeEventListener("ideaforge:tour", start); if (t) clearTimeout(t); };
  }, []);

  useLayoutEffect(() => {
    if (i === null) return;
    const el = document.querySelector(`[data-tour="${STEPS[i].target}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(update, 350);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [i]);

  const close = () => { setI(null); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  if (i === null) return null;
  const s = STEPS[i];
  const pad = 8;
  const below = rect ? rect.bottom + 180 < window.innerHeight : true;
  const cardTop = rect ? (below ? rect.bottom + 14 : Math.max(12, rect.top - 170)) : window.innerHeight / 2 - 80;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - 170), window.innerWidth - 352) : window.innerWidth / 2 - 170;

  return (
    <AnimatePresence>
      <motion.div key="tour" className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="Guided tour">
        <div className="absolute inset-0" onClick={close} />
        {rect && <motion.div className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-400"
          animate={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }} style={{ boxShadow: "0 0 0 9999px rgb(15 23 42 / .55)" }} />}
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="absolute w-[340px] max-w-[calc(100vw-24px)] rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#141B33]" style={{ top: cardTop, left: cardLeft }}>
          <button className="absolute right-3 top-3 text-ink-mute hover:text-ink" onClick={close} aria-label="Close tour"><X size={16} /></button>
          <div className="text-xs font-semibold text-brand-600 dark:text-brand-300">Quick tour</div>
          <div className="mt-1 font-bold">{s.title}</div>
          <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{s.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">{STEPS.map((_, k) => <span key={k} className={`h-1.5 w-5 rounded-full ${k <= i ? "bg-brand-600" : "bg-slate-200 dark:bg-white/10"}`} />)}</div>
            <div className="flex gap-2">
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={close}>Skip</button>
              <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : close())}>
                {i < STEPS.length - 1 ? <>Next <ArrowRight size={13} /></> : "Got it"}</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
