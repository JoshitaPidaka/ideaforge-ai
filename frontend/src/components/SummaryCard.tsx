import { motion } from "framer-motion";
import { Baby, Boxes, Cpu, Loader2, Rocket, Sparkles, Target, TriangleAlert, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type Item } from "../lib/api";
import { ws } from "../lib/ws";
import { useApp } from "../lib/store";
import { ErrorBox, Quote } from "./ui";

/** Gemma-generated summary card for a GitHub project or a paper, with verified evidence. Cached server-side. */
export function SummaryCard({ item, projectId }: { item: Pick<Item, "id" | "type" | "title">; projectId?: string }) {
  const { collection, simple, health } = useApp();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => { setData(null); api.cachedSummary(item.id).then((r) => r.summary && setData(r.summary)).catch(() => {}); }, [item.id]);

  const run = async () => {
    setBusy(true); setError(null);
    try { setData((projectId ? await ws.summary(projectId, item.id) : await api.itemSummary(item.id, collection)).summary); } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };

  if (!data) return (
    <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm"><div className="font-semibold">✨ AI {item.type === "project" ? "project" : "paper"} summary</div>
          <div className="text-xs text-ink-mute">{item.type === "project" ? "What it does, key features, tech stack, maturity and how to get started, read from the README." : "Problem, method, data, findings and limitations, read from the abstract."}</div></div>
        <button className="btn-primary !py-2" onClick={run} disabled={busy || !health?.ai.available} title={health?.ai.available ? "" : "Connect Gemma 4 to generate summaries"}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? "Summarising…" : "Generate with Gemma"}
        </button>
      </div>
      <div className="mt-2"><ErrorBox error={error} /></div>
    </div>
  );

  const s = data;
  const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) =>
    children ? <div className="flex gap-3"><div className="mt-0.5 text-brand-600 dark:text-brand-300">{icon}</div><div className="min-w-0 flex-1"><div className="label">{label}</div><div className="text-sm">{children}</div></div></div> : null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-violet-50 p-5 dark:border-brand-500/30 dark:from-brand-500/10 dark:via-transparent dark:to-violet-500/10">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-200"><Cpu size={13} /> AI summary · Gemma 4</div>
      <p className="text-[15px] font-semibold leading-snug">{simple && s.eli5 ? s.eli5 : s.one_liner}</p>
      <div className="mt-4 space-y-3">
        {item.type === "project" ? <>
          <Row icon={<Target size={16} />} label="What it does">{s.what_it_does}</Row>
          {s.key_features?.length > 0 && <Row icon={<Boxes size={16} />} label="Key features"><ul className="list-disc space-y-0.5 pl-4">{s.key_features.map((f: string) => <li key={f}>{f}</li>)}</ul></Row>}
          {s.tech_stack?.length > 0 && <Row icon={<Wrench size={16} />} label="Tech stack"><div className="flex flex-wrap gap-1.5">{s.tech_stack.map((t: string) => <span key={t} className="chip bg-white text-ink-soft ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">{t}</span>)}</div></Row>}
          <Row icon={<Cpu size={16} />} label="How it works">{s.how_it_works}</Row>
          <Row icon={<Rocket size={16} />} label={`Maturity: ${s.maturity || "?"}`}>{s.maturity_reason}</Row>
          <Row icon={<Baby size={16} />} label="Good for">{s.audience}</Row>
          <Row icon={<Rocket size={16} />} label="Getting started">{s.getting_started}</Row>
        </> : <>
          <Row icon={<Target size={16} />} label="Problem">{s.problem}</Row>
          <Row icon={<Wrench size={16} />} label="Method">{s.method}</Row>
          <Row icon={<Boxes size={16} />} label="Data">{s.data}</Row>
          <Row icon={<Rocket size={16} />} label="Findings">{s.findings}</Row>
        </>}
        <Row icon={<TriangleAlert size={16} />} label="Limitations">{s.limitations}</Row>
      </div>
      {s.evidence?.length > 0 && <div className="mt-4"><div className="label">Evidence from the source</div>{s.evidence.map((e: any) => <Quote key={e.quote} text={e.quote} ok={e.verified} />)}</div>}
    </motion.div>
  );
}
