import clsx from "clsx";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, CircleSlash, FlaskConical, Loader2, Play, Plus, Settings2, Sparkles, Timer, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Busy } from "../../components/kit";
import { Empty, ErrorBox } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws } from "../../lib/ws";
import { useProject } from "../Workspace";

const METRICS = [
  { k: "faithfulness", l: "Faithfulness", d: "Answer claims supported by retrieved context" },
  { k: "answer_relevance", l: "Answer relevance", d: "Answer addresses the question" },
  { k: "context_precision", l: "Context precision", d: "Retrieved chunks that are relevant" },
  { k: "context_recall", l: "Context recall", d: "Expected files that were retrieved" },
  { k: "citation_accuracy", l: "Citation accuracy", d: "Cited excerpts found verbatim (deterministic)" },
];
const COLORS = ["#6366F1", "#06B6D4", "#F59E0B", "#10B981", "#EC4899", "#8B5CF6"];

function Gauge({ v, label, desc }: { v: number | null; label: string; desc: string }) {
  const pct = v == null ? 0 : Math.round(v * 100);
  const color = v == null ? "#94A3B8" : v >= 0.75 ? "#10B981" : v >= 0.5 ? "#F59E0B" : "#F43F5E";
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="glass-card flex flex-col items-center p-4 text-center" title={desc}>
      <div className="relative h-24 w-24"><svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90"><circle cx="42" cy="42" r={r} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-white/10" />
        <motion.circle cx="42" cy="42" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke={color} strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1 }} /></svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold" style={{ color }}>{v == null ? "n/a" : pct}</span></div>
      <div className="mt-2 text-sm font-semibold">{label}</div><div className="text-[11px] text-ink-mute">{desc}</div>
    </div>
  );
}

export default function EvaluationView() {
  const { project } = useProject();
  const [scans, setScans] = useState<{ id: string; url: string }[]>([]);
  const [scanId, setScanId] = useState("");
  const [set, setSet] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [cur, setCur] = useState<any>(null);
  const [k, setK] = useState(6);
  const [retriever, setRetriever] = useState("hybrid");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(0);

  useEffect(() => {
    ws.scans().then((s) => { setScans(s); if (s[0]) setScanId(s[0].id); }).catch(() => {});
    ws.runs().then((r) => { setRuns(r); if (r[0]) { ws.getRun(r[0].id).then(setCur); ws.get(project.id); } }).catch(() => {});
  }, [project.id]);
  useEffect(() => { if (cur?.set_id && !set) fetch(`/api/eval/sets/${cur.set_id}`).then((r) => r.json()).then(setSet).catch(() => {}); }, [cur]); // eslint-disable-line

  const gen = async () => { setBusy("gen"); setError(null); try { setSet(await ws.genSet(scanId, 6)); } catch (e) { setError(e as ApiError); } finally { setBusy(""); } };
  const run = async () => {
    if (!set) return; setBusy("run"); setError(null);
    try { await ws.putSet(set.id, set.questions); const r = await ws.run(set.id, k, retriever, `${retriever} k=${k}`); setCur(r); setRuns(await ws.runs()); }
    catch (e) { setError(e as ApiError); } finally { setBusy(""); }
  };
  const updQ = (i: number, patch: any) => setSet({ ...set, questions: set.questions.map((q: any, j: number) => (j === i ? { ...q, ...patch } : q)) });
  const setRuns_ = runs.filter((r) => !set || r.set_id === set.id);
  const chart = METRICS.map((m) => ({ metric: m.l, ...Object.fromEntries(setRuns_.slice(0, 5).map((r) => [r.config.label + " · " + r.id.slice(0, 4), r.summary[m.k] ?? 0])) }));

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="section-title"><FlaskConical size={16} className="text-pink-500" /> Measure IdeaForge's own answers</div>
        <p className="mt-1 text-sm text-ink-mute">Evaluates the "Ask your repository" RAG pipeline on a question set. Gemma 4 acts as judge for faithfulness, relevance and context precision; citation accuracy and recall are computed in code. Automated scores are imperfect, so inspect the evidence below.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={scanId} onChange={(e) => setScanId(e.target.value)} aria-label="Repository">{scans.length === 0 && <option value="">Inspect a repository in Repo Onboarding first</option>}
            {scans.map((s) => <option key={s.id} value={s.id}>{s.id.replace("__", "/")}</option>)}</select>
          <button className="btn-outline" onClick={gen} disabled={!scanId || !!busy}>{busy === "gen" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generate question set</button>
        </div>
      </div>
      <ErrorBox error={error} />

      {busy === "gen" ? <Busy label="Writing evaluation questions from the repository…" /> : set && (
        <div className="glass-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="section-title">Question set <span className="text-xs font-normal text-ink-mute">({set.questions.length} · editable)</span></div>
            <button className="btn-ghost !py-1 text-xs" onClick={() => setSet({ ...set, questions: [...set.questions, { question: "", expected: "", expected_files: [], answerable: true }] })}><Plus size={13} /> Add question</button></div>
          <div className="space-y-2">{set.questions.map((q: any, i: number) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200/70 p-3 dark:border-white/[.07] md:grid-cols-[1fr_1fr_auto]">
              <input className="input text-[13px]" value={q.question} placeholder="Question" onChange={(e) => updQ(i, { question: e.target.value })} />
              <input className="input text-[13px]" value={q.expected} placeholder="Expected answer" onChange={(e) => updQ(i, { expected: e.target.value })} />
              <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-pink-500" checked={q.answerable !== false} onChange={(e) => updQ(i, { answerable: e.target.checked })} /> answerable</label>
                <button className="btn-ghost !p-1.5" onClick={() => setSet({ ...set, questions: set.questions.filter((_: any, j: number) => j !== i) })} aria-label="Remove"><Trash2 size={14} /></button></div>
            </div>))}</div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[.03]">
            <Settings2 size={15} className="text-ink-mute" /><span className="text-sm font-semibold">Run configuration</span>
            <select className="input !w-auto !py-1.5 text-xs" value={retriever} onChange={(e) => setRetriever(e.target.value)} aria-label="Retriever"><option value="hybrid">Hybrid (LSA + BM25, RRF)</option><option value="dense">Dense only</option><option value="bm25">BM25 only</option></select>
            <label className="flex items-center gap-2 text-xs">top-k <input type="range" min={2} max={12} value={k} onChange={(e) => setK(+e.target.value)} className="accent-pink-500" /><span className="w-5 font-mono">{k}</span></label>
            <span className="text-[11px] text-ink-mute">Model: Gemma 4 · chunks: 60-line windows</span>
            <button className="btn-primary ml-auto" onClick={run} disabled={!!busy || set.questions.length === 0}>{busy === "run" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run evaluation</button>
          </div>
        </div>)}

      {busy === "run" ? <Busy label="Running the evaluation…" steps={["Retrieving context for each question…", "Generating answers…", "Judging faithfulness and relevance…", "Verifying citations…"]} /> : cur ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Run {cur.id}</span><span className="chip bg-pink-500/15 text-pink-700 dark:text-pink-200">{cur.config.label}</span>
            <span className="text-xs text-ink-mute">{cur.summary.questions} questions · {cur.summary.failed} flagged · <Timer size={11} className="inline" /> {cur.summary.avg_latency_s}s avg</span></div>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">{METRICS.map((m) => <Gauge key={m.k} v={cur.summary[m.k]} label={m.l} desc={m.d} />)}</div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="glass-card overflow-hidden">
              <div className="border-b border-slate-200/70 px-5 py-3 text-sm font-bold dark:border-white/[.07]">Per-question results</div>
              {cur.results.map((r: any, i: number) => (
                <div key={i} className="border-b border-slate-200/50 last:border-0 dark:border-white/[.05]">
                  <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-slate-900/[.02] dark:hover:bg-white/[.03]" onClick={() => setOpenRow(openRow === i ? null : i)}>
                    {r.issue === "none" ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> : <XCircle size={16} className="shrink-0 text-rose-500" />}
                    <span className="flex-1">{r.question}{!r.answerable && <span className="chip ml-2 bg-slate-200 dark:bg-white/10"><CircleSlash size={10} /> unanswerable</span>}</span>
                    {["faithfulness", "answer_relevance", "context_precision"].map((m) => <span key={m} className="hidden w-10 text-right font-mono text-xs sm:block">{r[m] == null ? "n/a" : Math.round(r[m] * 100)}</span>)}
                    <ChevronDown size={15} className={clsx("transition", openRow === i && "rotate-180")} /></button>
                  {openRow === i && <div className="space-y-3 bg-slate-50/60 px-5 py-4 text-sm dark:bg-white/[.02]">
                    {r.issue !== "none" && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"><b>{r.issue.replace("_", " ")}</b> {r.note}</div>}
                    <div><div className="label">Answer</div><p className="mt-1">{r.answer}</p></div>
                    {r.expected && <div><div className="label">Expected</div><p className="mt-1 text-ink-mute">{r.expected}</p></div>}
                    {r.claims?.length > 0 && <div><div className="label mb-1">Claims</div>{r.claims.map((c: any, j: number) => (
                      <div key={j} className="flex gap-2 text-[13px]">{c.supported ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />}{c.claim}</div>))}</div>}
                    <div><div className="label mb-1">Retrieved context (ranked)</div>{r.contexts.map((c: any, j: number) => (
                      <div key={j} className="mb-1 flex items-start gap-2 text-xs"><span className={clsx("mt-0.5 h-2 w-2 shrink-0 rounded-full", c.relevant ? "bg-emerald-500" : c.relevant === 0 ? "bg-rose-400" : "bg-slate-400")} />
                        <span className="font-mono">{j + 1}. {c.path}:{c.start}-{c.end}</span><span className="truncate text-ink-mute">{c.preview?.slice(0, 80)}</span></div>))}</div>
                  </div>}
                </div>))}
            </div>
            <div className="space-y-4">
              <div className="glass-card p-5"><div className="section-title mb-2">Failure analysis</div>
                {Object.entries(cur.summary.issues || {}).map(([k2, v]: any) => <div key={k2} className="flex items-center justify-between border-b border-slate-200/50 py-1.5 text-sm last:border-0 dark:border-white/[.05]"><span className="capitalize">{k2.replace("_", " ")}</span><span className="font-mono font-bold">{v}</span></div>)}</div>
              {setRuns_.length > 1 && <div className="glass-card h-80 p-4"><div className="section-title mb-2">Configuration comparison</div>
                <ResponsiveContainer height="88%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" /><XAxis dataKey="metric" tick={{ fontSize: 9 }} interval={0} /><YAxis domain={[0, 1]} width={28} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: "#0f172a", color: "#fff", border: "none" }} /><Legend wrapperStyle={{ fontSize: 10 }} />
                  {setRuns_.slice(0, 5).map((r, i) => <Bar key={r.id} dataKey={r.config.label + " · " + r.id.slice(0, 4)} fill={COLORS[i]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div>}
              <div className="glass-card p-4"><div className="label mb-2">Run history</div>{runs.slice(0, 8).map((r) => (
                <button key={r.id} onClick={() => ws.getRun(r.id).then(setCur)} className={clsx("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-900/[.04] dark:hover:bg-white/[.05]", cur.id === r.id && "bg-pink-500/10")}>
                  <span>{r.config.label}</span><span className="font-mono text-ink-mute">faith {r.summary.faithfulness == null ? "n/a" : Math.round(r.summary.faithfulness * 100)}</span></button>))}</div>
            </div>
          </div>
        </>
      ) : !set && <Empty icon={<FlaskConical />} title="No evaluation runs yet">Inspect a repository in Repo Onboarding, generate a question set, then run and compare retrieval configurations.</Empty>}
    </div>
  );
}
