import clsx from "clsx";
import { motion } from "framer-motion";
import { Bot, Braces, Download, FileText, Loader2, NotebookPen, Printer, Quote as QuoteIcon, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { api, ApiError, type Analysis } from "../lib/api";
import { useApp } from "../lib/store";
import { ErrorBox, Section, Verified } from "./ui";

// ------------------------------------------------------------------ similarity map
export function MapView({ a, onOpenLead }: { a: Analysis; onOpenLead: (id: string) => void }) {
  const pts = a.map_points;
  const groups = [
    { name: "Lead · paper", data: pts.filter((p) => p.lead && p.kind === "paper"), fill: "#0284C7", z: 160 },
    { name: "Lead · project", data: pts.filter((p) => p.lead && p.kind === "project"), fill: "#7C3AED", z: 160 },
    { name: "Other nearby items", data: pts.filter((p) => !p.lead && p.kind !== "proposal"), fill: "#94A3B8", z: 50 },
    { name: "Your proposal", data: pts.filter((p) => p.kind === "proposal"), fill: "#F59E0B", z: 400 },
  ];
  return (
    <Section title="Similarity map" sub="A 2-D projection of the embedding space: items closer to the glowing dot are more similar to your proposal. Click a lead to open it.">
      <div className="card h-[460px] p-4">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
            <XAxis type="number" dataKey="x" hide domain={[-1.1, 1.1]} /><YAxis type="number" dataKey="y" hide domain={[-1.1, 1.1]} />
            <ZAxis type="number" dataKey="z" range={[40, 420]} />
            <Tooltip cursor={false} content={({ payload }) => {
              const p: any = payload?.[0]?.payload; if (!p) return null;
              return <div className="max-w-xs rounded-xl bg-white px-3 py-2 text-xs shadow-xl dark:bg-slate-800"><div className="font-semibold">{p.title}</div>
                {p.similarity != null && <div className="text-ink-mute">similarity {p.similarity.toFixed(2)}</div>}</div>;
            }} />
            {groups.map((g) => <Scatter key={g.name} name={g.name} data={g.data.map((d) => ({ ...d, z: g.z }))} fill={g.fill} fillOpacity={g.name.startsWith("Other") ? 0.45 : 0.9}
              onClick={(d: any) => d?.lead && onOpenLead(d.id)} className={g.name.startsWith("Lead") ? "cursor-pointer" : ""} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">{groups.map((g) => <span key={g.name} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: g.fill }} />{g.name}</span>)}</div>
    </Section>
  );
}

// ------------------------------------------------------------------ ask the evidence
interface Msg { role: "user" | "ai"; text: string; citations?: { lead_id: string; title: string; url: string; quote: string; verified: boolean }[]; confidence?: string }
const SUGGESTED = ["Which lead is closest to my idea, and why?", "Has anyone built this offline or on mobile?", "What datasets do similar projects use?", "What is missing in existing work that I could add?"];

export function AskView({ a, onOpenLead }: { a: Analysis; onOpenLead: (id: string) => void }) {
  const { health } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: question }]); setQ(""); setBusy(true); setError(null);
    try { const r = await api.ask(a.id, question); setMsgs((m) => [...m, { role: "ai", text: r.answer, citations: r.citations, confidence: r.confidence }]); }
    catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Section title="Ask the evidence" icon={<Bot size={18} className="text-brand-600" />} sub="Chat with your leads. Answers use only the sources found, cite them, and show verified quotes.">
      <div className="card flex min-h-[420px] flex-col">
        <div className="flex-1 space-y-4 p-5">
          {msgs.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">{SUGGESTED.map((s) => (
              <button key={s} disabled={!health?.ai.available} onClick={() => ask(s)} className="rounded-xl border border-slate-200 p-3 text-left text-sm hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5">
                <Sparkles size={14} className="mb-1 text-brand-500" />{s}</button>))}
              {!health?.ai.available && <p className="text-xs text-amber-700 sm:col-span-2">Connect Gemma 4 (GEMINI_API_KEY) to chat with the evidence.</p>}
            </div>
          )}
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={clsx("flex", m.role === "user" && "justify-end")}>
              <div className={clsx("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.role === "user" ? "bg-gradient-to-r from-brand-600 to-violet-600 text-white" : "bg-slate-100 dark:bg-white/5")}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.citations && m.citations.length > 0 && <div className="mt-3 space-y-2">{m.citations.map((c, k) => (
                  <div key={k} className="rounded-xl bg-white p-2.5 text-xs dark:bg-white/5">
                    <div className="flex items-center justify-between gap-2"><button className="truncate font-semibold text-brand-700 hover:underline dark:text-brand-200" onClick={() => onOpenLead(c.lead_id)}>{c.title}</button>{c.quote && <Verified ok={c.verified} />}</div>
                    {c.quote && <p className="mt-1 font-mono text-[11px] text-ink-soft dark:text-slate-300">“{c.quote}”</p>}
                  </div>))}</div>}
                {m.confidence && <div className="mt-2 text-[10px] uppercase tracking-wide opacity-60">confidence: {m.confidence}</div>}
              </div>
            </motion.div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-ink-mute"><Loader2 size={15} className="animate-spin" /> Reading the leads…</div>}
          <ErrorBox error={error} />
        </div>
        <form className="flex gap-2 border-t border-slate-100 p-3 dark:border-white/5" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input className="input" placeholder="Ask anything about the related work…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!health?.ai.available} />
          <button className="btn-primary" disabled={busy || !q.trim()} aria-label="Send"><Send size={16} /></button>
        </form>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ review & export
export function ExportView({ a, toast }: { a: Analysis; toast: (m: string) => void }) {
  const { health } = useApp();
  const [rw, setRw] = useState<{ markdown: string; used_unreviewed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const counts = { relevant: 0, not_relevant: 0, needs_reading: 0, unreviewed: 0 } as Record<string, number>;
  a.leads.forEach((l) => counts[l.review]++);
  const reviewed = a.leads.length - counts.unreviewed;
  const url = (f: string) => `/api/analyses/${a.id}/export?format=${f}`;
  const draft = async () => { setBusy(true); setError(null); try { setRw(await api.relatedWork(a.id)); } catch (e) { setError(e as ApiError); } finally { setBusy(false); } };

  return (
    <div className="space-y-8">
      <Section title="Review progress" sub="Results are leads for human review. Exports include the leads you marked Relevant or Needs reading (or all leads if you haven't reviewed any yet).">
        <div className="card p-5">
          <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            {(["relevant", "needs_reading", "not_relevant"] as const).map((k) => <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${(counts[k] / a.leads.length) * 100}%` }}
              className={k === "relevant" ? "bg-emerald-500" : k === "needs_reading" ? "bg-sky-500" : "bg-slate-400"} />)}
          </div>
          <div className="flex flex-wrap gap-5 text-sm"><span>✅ <b>{counts.relevant}</b> relevant</span><span>📖 <b>{counts.needs_reading}</b> to read</span><span>👎 <b>{counts.not_relevant}</b> dismissed</span>
            <span className="text-ink-mute">{counts.unreviewed} unreviewed · {reviewed}/{a.leads.length} done</span></div>
        </div>
      </Section>

      <Section title="Export" icon={<Download size={18} className="text-brand-600" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: url("html"), icon: <Printer />, t: "PDF report", d: "Print-ready report → Save as PDF" },
            { href: url("md"), icon: <FileText />, t: "Markdown", d: "For your README or notes" },
            { href: url("bibtex"), icon: <QuoteIcon />, t: "BibTeX", d: "References for LaTeX / Overleaf" },
            { href: url("json"), icon: <Braces />, t: "JSON", d: "Full machine-readable result" },
          ].map((e) => (
            <a key={e.t} href={e.href} target={e.t === "PDF report" ? "_blank" : undefined} rel="noreferrer" className="card group flex items-center gap-3 p-4 transition hover:shadow-glow">
              <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 transition group-hover:scale-110 dark:bg-brand-500/10 dark:text-brand-300">{e.icon}</div>
              <div><div className="font-semibold">{e.t}</div><div className="text-xs text-ink-mute">{e.d}</div></div>
            </a>
          ))}
        </div>
      </Section>

      <Section title="Related Work draft" icon={<NotebookPen size={18} className="text-brand-600" />} sub="A literature-survey section for your report, written only from leads you marked Relevant, with real citations."
        right={<button className="btn-primary" onClick={draft} disabled={busy || !health?.ai.available}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {rw ? "Regenerate" : "Write draft"}</button>}>
        <ErrorBox error={error} />
        {rw ? (
          <div className="card p-5">
            {rw.used_unreviewed && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">No leads were marked Relevant yet, so the top 6 leads were used. Review leads for a better draft.</p>}
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{rw.markdown}</pre>
            <button className="btn-outline mt-4" onClick={() => { navigator.clipboard?.writeText(rw.markdown); toast("Draft copied"); }}>Copy markdown</button>
          </div>
        ) : !health?.ai.available && <p className="text-xs text-amber-700">Connect Gemma 4 to generate the draft.</p>}
      </Section>
    </div>
  );
}
