import { motion } from "framer-motion";
import { BadgeCheck, Database, Loader2, Radar, ScanSearch, UserCheck } from "lucide-react";
import { useState } from "react";
import { ErrorBox } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws } from "../../lib/ws";
import { AnalysisBody } from "../Analysis";
import { useProject } from "../Workspace";

export default function NoveltyView() {
  const { project, reload } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try { await ws.novelty(project.id); await reload(); } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  const ev = (project.counts.research ?? 0) + (project.counts.github ?? 0);

  if (project.novelty_analysis) return <AnalysisBody id={project.novelty_analysis} embedded onRerun={run} key={project.novelty_analysis} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card gradient-border relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-rose-500/25 blur-3xl" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-glow"><Radar size={30} /></div>
        <h2 className="relative mt-4 text-2xl font-extrabold tracking-tight">Project Report Novelty & Prior-Art Explorer</h2>
        <p className="relative mx-auto mt-2 max-w-xl text-sm text-ink-soft dark:text-slate-300">
          Checks each of your {project.brief?.contributions.length} claimed contributions against a <b>bounded collection</b>: the {ev} papers, patents and repositories you discovered, plus the seed collection.
          Every overlap is explained aspect by aspect, with quotes verified word-for-word.
        </p>
        <div className="relative mt-6 grid gap-3 text-left sm:grid-cols-3">
          {[[<ScanSearch size={16} />, "Semantic retrieval", "Hybrid embeddings + BM25, one query per contribution"],
            [<BadgeCheck size={16} />, "Evidence-grounded", "Every quote checked against the source"],
            [<UserCheck size={16} />, "Leads for review", "You mark each lead relevant or not"]].map(([i, t, d]) => (
            <div key={t as string} className="rounded-xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/[.07] dark:bg-white/[.03]">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-300">{i}{t}</div><div className="mt-1 text-xs text-ink-mute">{d}</div></div>))}
        </div>
        <button className="btn-primary relative mt-7 px-6 py-3 text-base" onClick={run} disabled={busy}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Radar size={18} />} Run novelty analysis</button>
        {ev === 0 && <p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-300"><Database size={12} /> Tip: run Papers & Patents and GitHub first so the collection includes your own discoveries.</p>}
      </motion.div>
      <ErrorBox error={error} />
    </div>
  );
}
