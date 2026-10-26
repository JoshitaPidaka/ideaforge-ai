import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, Files, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Shell } from "../components/Layout";
import { ErrorBox, Section } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/store";

type Result = Awaited<ReturnType<typeof api.batch>>;

export default function BatchPage() {
  const { collection } = useApp();
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const run = async (files: FileList) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    fd.append("collection_name", collection);
    setBusy(true); setError(null);
    try { setRes(await api.batch(fd)); } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  const shade = (v: number) => (v >= 0.8 ? "bg-rose-500 text-white" : v >= 0.6 ? "bg-amber-400 text-ink" : v >= 0.4 ? "bg-brand-200 text-ink dark:bg-brand-500/40 dark:text-white" : "bg-slate-100 dark:bg-white/5");
  const short = (s: string) => s.replace(/\.\w+$/, "").slice(0, 22);

  return (
    <Shell>
      <div className="mb-6 mt-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Files className="text-brand-600" /> Batch compare</h1>
        <p className="text-sm text-ink-mute dark:text-slate-400">For mentors, faculty and hackathon organisers: upload several proposals to spot duplicate topics within a class or event, and see each one's closest prior art.</p>
      </div>
      <div className="card flex flex-col items-center gap-3 border-2 border-dashed p-10 text-center">
        <input ref={ref} type="file" multiple hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => e.target.files && run(e.target.files)} />
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-3 text-white shadow-glow">{busy ? <Loader2 className="animate-spin" /> : <Upload />}</div>
        <div className="font-semibold">Upload 2–30 proposals</div>
        <div className="text-xs text-ink-mute">PDF, DOCX, TXT or MD · compared with semantic embeddings</div>
        <button className="btn-primary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Comparing…" : "Choose files"}</button>
      </div>
      <div className="mt-4"><ErrorBox error={error} /></div>

      {res && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 space-y-8">
          <Section title="Similarity matrix" sub={`Pairwise semantic similarity between proposals (${res.embedder}).`}>
            <div className="card overflow-x-auto p-4">
              <table className="border-separate border-spacing-1 text-xs">
                <thead><tr><th />{res.names.map((n) => <th key={n} className="max-w-[90px] truncate px-1 font-semibold" title={n}>{short(n)}</th>)}</tr></thead>
                <tbody>{res.matrix.map((row, i) => (
                  <tr key={i}><th className="max-w-[140px] truncate pr-2 text-left font-semibold" title={res.names[i]}>{short(res.names[i])}</th>
                    {row.map((v, j) => <td key={j} className={clsx("h-10 w-16 rounded-md text-center font-mono", i === j ? "bg-slate-200/60 text-ink-mute dark:bg-white/5" : shade(v))}>{i === j ? "·" : v.toFixed(2)}</td>)}</tr>))}</tbody>
              </table>
            </div>
          </Section>
          <Section title="Most similar pairs" icon={<AlertTriangle size={18} className="text-amber-500" />} sub="Pairs worth a human look. A high similarity score is a lead, not an accusation.">
            <div className="card divide-y divide-slate-100 dark:divide-white/5">{res.pairs.slice(0, 8).map((p) => (
              <div key={p.a + p.b} className="flex items-center gap-3 px-5 py-3 text-sm"><span className="flex-1 truncate"><b>{short(p.a)}</b> ↔ <b>{short(p.b)}</b></span>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={clsx("h-full", p.similarity >= 0.8 ? "bg-rose-500" : p.similarity >= 0.6 ? "bg-amber-400" : "bg-brand-400")} style={{ width: `${Math.max(0, p.similarity) * 100}%` }} /></div>
                <span className="w-12 text-right font-mono">{p.similarity.toFixed(2)}</span></div>))}</div>
          </Section>
          <Section title="Closest prior art per proposal" sub={`From the “${collection}” collection.`}>
            <div className="grid gap-3 md:grid-cols-2">{res.nearest.map((n) => (
              <div key={n.proposal} className="card p-4"><div className="mb-2 font-semibold">{n.proposal}</div>
                <ul className="space-y-1 text-sm">{n.leads.map((l) => <li key={l.id}><a className="flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-200" href={l.url} target="_blank" rel="noreferrer">{l.title} <ExternalLink size={11} /></a></li>)}</ul></div>))}</div>
          </Section>
        </motion.div>
      )}
    </Shell>
  );
}
