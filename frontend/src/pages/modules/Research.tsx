import clsx from "clsx";
import { motion } from "framer-motion";
import { BookOpenText, Bookmark, BookmarkCheck, CalendarRange, GitCompareArrows, Lightbulb, Loader2, Plus, Quote, ScrollText, Search, TrendingUp, Unlock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Busy, ExtLink, KindIcon, Label, RelevanceBar, SourceStatusBar } from "../../components/kit";
import { SummaryCard } from "../../components/SummaryCard";
import { Drawer, Empty, ErrorBox, Verified } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws, type Evidence, type RunInfo } from "../../lib/ws";
import { useProject } from "../Workspace";

type Tab = "papers" | "patents" | "gaps" | "compare" | "timeline";

export function QueryEditor({ queries, setQueries, onRun, busy, extra }: { queries: string[]; setQueries: (q: string[]) => void; onRun: () => void; busy: boolean; extra?: React.ReactNode }) {
  const [q, setQ] = useState("");
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search size={16} className="ml-1 text-ink-mute" />
        {queries.map((x) => (
          <span key={x} className="chip border border-brand-200 bg-brand-50 py-1 text-brand-800 dark:border-brand-400/25 dark:bg-brand-500/10 dark:text-brand-100">{x}
            <button aria-label={`Remove ${x}`} onClick={() => setQueries(queries.filter((y) => y !== x))}><X size={12} /></button></span>
        ))}
        <form className="min-w-[200px] flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { setQueries([...queries, q.trim()]); setQ(""); } }}>
          <input className="w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none" placeholder="Add a search phrase and press Enter…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {extra}
        <button className="btn-primary" onClick={onRun} disabled={busy || queries.length === 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search</button>
      </div>
    </div>
  );
}

function PaperCard({ e, i, onOpen, onSave, selected, onSelect }: { e: Evidence; i: number; onOpen: () => void; onSave: () => void; selected: boolean; onSelect: () => void }) {
  const it = e.item;
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} onClick={onOpen}
      className={clsx("glass-card glass-hover group cursor-pointer p-5", selected && "ring-2 ring-brand-500")}>
      <div className="flex items-start gap-3">
        <div className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white", e.kind === "patent" ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-sky-500 to-cyan-600")}><KindIcon kind={e.kind} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-300">{it.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
            <span className="truncate">{it.authors_or_owner?.split(",").slice(0, 2).join(", ")}</span>{it.year && <span>{it.year}</span>}
            {it.venue_or_language && <span className="truncate italic">{it.venue_or_language}</span>}
            {it.meta?.citations != null && <span>{it.meta.citations} citations</span>}
            {it.meta?.open_access && <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><Unlock size={11} /> Open access</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={(ev) => { ev.stopPropagation(); onSave(); }} className="text-ink-mute hover:text-brand-500" aria-label={e.saved ? "Remove from library" : "Save to library"}>
            {e.saved ? <BookmarkCheck size={18} className="text-brand-500" /> : <Bookmark size={18} />}</button>
          <input type="checkbox" checked={selected} onClick={(ev) => ev.stopPropagation()} onChange={onSelect} aria-label="Select for comparison" className="h-4 w-4 accent-brand-600" />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-soft dark:text-slate-300">{it.text}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">{e.why.length > 0 && <span className="text-[11px] text-ink-mute">Matches:</span>}
          {e.why.slice(0, 4).map((w) => <span key={w} className="chip bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">{w}</span>)}</div>
        <RelevanceBar value={e.relevance} />
      </div>
    </motion.article>
  );
}

export default function ResearchView() {
  const { project, reload } = useProject();
  const [queries, setQueries] = useState<string[]>(project.queries?.paper_queries ?? [project.title]);
  const [year, setYear] = useState<number | null>(null);
  const [items, setItems] = useState<Evidence[]>([]);
  const [run, setRun] = useState<Omit<RunInfo, "results"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<Tab>("papers");
  const [open, setOpen] = useState<Evidence | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [gaps, setGaps] = useState<any>(null);
  const [cmp, setCmp] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState("");

  useEffect(() => {
    ws.evidence(project.id, "research").then(setItems).catch(() => {});
    ws.artifact(project.id, "research_run").then((r) => r?.queries && setRun(r)).catch(() => {});
    ws.artifact(project.id, "research_gaps").then((g) => g?.themes && setGaps(g)).catch(() => {});
  }, [project.id]);

  const search = async () => {
    setBusy(true); setError(null);
    try { const r = await ws.research(project.id, queries, year); setRun(r); setItems(r.results); reload(); } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  const papers = useMemo(() => items.filter((e) => e.kind === "paper"), [items]);
  const patents = useMemo(() => items.filter((e) => e.kind === "patent"), [items]);
  const toggleSave = async (e: Evidence) => { await ws.save(project.id, e.item.id, !e.saved); setItems(items.map((x) => (x.item.id === e.item.id ? { ...x, saved: !x.saved } : x))); };
  const toggleSel = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 5 ? [...sel, id] : sel);
  const timeline = useMemo(() => {
    const m = new Map<number, { year: number; papers: number; patents: number }>();
    items.forEach((e) => { const y = e.item.year; if (!y) return; const r = m.get(y) ?? { year: y, papers: 0, patents: 0 }; e.kind === "patent" ? r.patents++ : r.papers++; m.set(y, r); });
    return [...m.values()].sort((a, b) => a.year - b.year);
  }, [items]);

  const doGaps = async () => { setAiBusy("gaps"); setError(null); try { setGaps(await ws.gaps(project.id)); } catch (e) { setError(e as ApiError); } finally { setAiBusy(""); } };
  const doCmp = async () => { setAiBusy("cmp"); setError(null); setTab("compare"); try { setCmp(await ws.compare(project.id, sel)); } catch (e) { setError(e as ApiError); } finally { setAiBusy(""); } };

  const TABS: [Tab, string, React.ReactNode, number | null][] = [
    ["papers", "Papers", <BookOpenText size={15} />, papers.length], ["patents", "Patents", <ScrollText size={15} />, patents.length],
    ["gaps", "Gaps & opportunities", <Lightbulb size={15} />, gaps?.themes?.length ?? null], ["compare", "Compare", <GitCompareArrows size={15} />, sel.length || null],
    ["timeline", "Timeline", <TrendingUp size={15} />, null],
  ];

  return (
    <div className="space-y-5">
      <QueryEditor queries={queries} setQueries={setQueries} onRun={search} busy={busy} extra={
        <label className="chip border border-slate-200 bg-white/70 py-1.5 dark:border-white/10 dark:bg-white/5"><CalendarRange size={13} />
          <select className="bg-transparent text-xs focus:outline-none" value={year ?? ""} onChange={(e) => setYear(e.target.value ? +e.target.value : null)} aria-label="From year">
            <option value="">Any year</option>{[2024, 2022, 2020, 2018, 2015].map((y) => <option key={y} value={y}>Since {y}</option>)}</select></label>} />
      {run && <SourceStatusBar statuses={run.statuses} fallback={run.fallback_local} />}
      <ErrorBox error={error} />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([k, l, ic, n]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            tab === k ? "text-white" : "text-ink-mute hover:text-ink dark:hover:text-white")}>
            {tab === k && <motion.span layoutId="rtab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-500 to-brand-600 shadow-glow" />}
            <span className="relative flex items-center gap-2">{ic}{l}{n != null && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{n}</span>}</span>
          </button>
        ))}
        {sel.length >= 2 && tab !== "compare" && <button className="btn-outline ml-auto !py-1.5 text-xs" onClick={doCmp}><GitCompareArrows size={14} /> Compare {sel.length} selected</button>}
      </div>

      {busy ? <Busy label="Searching research sources…" steps={["Querying OpenAlex…", "Querying arXiv…", "Checking patent databases…", "Ranking by relevance to your idea…"]} /> : (
        <>
          {tab === "papers" && (papers.length === 0 ? <Empty icon={<BookOpenText />} title="No papers yet">Run a search. Results come from OpenAlex and arXiv; if they're unreachable, IdeaForge searches the local bounded collection instead.</Empty> :
            <div className="grid gap-4 lg:grid-cols-2">{papers.map((e, i) => <PaperCard key={e.item.id} e={e} i={i} onOpen={() => setOpen(e)} onSave={() => toggleSave(e)} selected={sel.includes(e.item.id)} onSelect={() => toggleSel(e.item.id)} />)}</div>)}

          {tab === "patents" && (
            <div className="space-y-5">
              {patents.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{patents.map((e, i) => <PaperCard key={e.item.id} e={e} i={i} onOpen={() => setOpen(e)} onSave={() => toggleSave(e)} selected={sel.includes(e.item.id)} onSelect={() => toggleSel(e.item.id)} />)}</div>
                : <div className="glass-card flex items-start gap-3 p-4 text-sm"><ScrollText className="mt-0.5 shrink-0 text-amber-500" size={18} />
                  <div><b>No live patent records.</b> {run?.statuses.find((s) => s.source === "PatentsView")?.note || run?.statuses.find((s) => s.source === "PatentsView")?.error || "Run a search first."}
                    <div className="mt-1 text-xs text-ink-mute">Use the claim-style queries below in official patent databases. These are search links, not results.</div></div></div>}
              {run?.patent_links && <div className="grid gap-4 md:grid-cols-2">{run.patent_links.map((pl) => (
                <div key={pl.query} className="glass-card p-5"><div className="label mb-1">Claim-style query</div><div className="font-semibold">“{pl.query}”</div>
                  <div className="mt-3 flex flex-wrap gap-2">{pl.links.map((l) => <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="btn-outline !py-1.5 text-xs">{l.name} ↗</a>)}</div></div>))}</div>}
              <p className="text-xs text-ink-mute">A similarity search is a research aid, not a patentability or freedom-to-operate opinion. Consult a patent professional for legal decisions.</p>
            </div>
          )}

          {tab === "gaps" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 glass-card p-4">
                <div className="text-sm"><b>Evidence-backed gaps:</b> Gemma reads the top papers' limitations and future-work statements, groups recurring themes, and links each theme to its sources with a verified quote.</div>
                <button className="btn-primary" onClick={doGaps} disabled={!!aiBusy || papers.length === 0}>{aiBusy === "gaps" ? <Loader2 size={15} className="animate-spin" /> : <Lightbulb size={15} />} {gaps ? "Regenerate" : "Find gaps"}</button>
              </div>
              {gaps?.summary && <div className="glass-card border-l-4 border-l-cyan-500 p-4 text-sm"><Label tone="ai">AI summary</Label> <span className="ml-1">{gaps.summary}</span></div>}
              <div className="grid gap-4 md:grid-cols-2">{(gaps?.themes || []).map((t: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-5">
                  <div className="font-semibold">{t.title}</div><p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{t.detail}</p>
                  {t.quote && <blockquote className="mt-3 rounded-lg border-l-[3px] border-emerald-500 bg-emerald-500/5 px-3 py-2 font-mono text-[12px]"><Quote size={11} className="mb-1" />{t.quote}<div className="mt-1"><Verified ok={!!t.verified} /></div></blockquote>}
                  {t.opportunity && <div className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-sm"><Label tone="rec">Opportunity</Label> {t.opportunity}</div>}
                  <div className="mt-2 text-[11px] text-ink-mute">Sources: {t.papers?.map((p: string) => items.find((x) => x.item.id === p)?.item.title?.slice(0, 40)).filter(Boolean).join(" · ")}</div>
                </motion.div>))}</div>
            </div>
          )}

          {tab === "compare" && (sel.length < 2 ? <Empty icon={<GitCompareArrows />} title="Select 2–5 papers">Tick the checkbox on paper cards, then compare them side by side.</Empty> : aiBusy === "cmp" ? <Busy label="Comparing selected papers…" /> : cmp ? (
            <div className="glass-card overflow-x-auto p-2">
              <table className="w-full min-w-[800px] text-sm"><thead><tr className="text-left text-xs text-ink-mute">{["Paper", "Problem", "Method", "Data", "Findings", "Limitations", "Relevance to you"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{cmp.rows.map((r: any) => <tr key={r.id} className="border-t border-slate-200/60 align-top dark:border-white/[.06]">{[r.title, r.problem, r.method, r.data, r.findings, r.limitations, r.relevance_to_idea].map((c, i) => <td key={i} className={clsx("px-3 py-3", i === 0 && "font-semibold")}>{c}</td>)}</tr>)}</tbody></table>
              {cmp.takeaway && <div className="m-3 rounded-xl bg-brand-500/10 p-3 text-sm"><Label tone="ai">Takeaway</Label> {cmp.takeaway}</div>}
            </div>) : <div className="text-center"><button className="btn-primary" onClick={doCmp}><GitCompareArrows size={15} /> Compare {sel.length} papers</button></div>)}

          {tab === "timeline" && (timeline.length < 2 ? <Empty icon={<TrendingUp />} title="Not enough dated results">Search first; years come from the paper and patent metadata.</Empty> : (
            <div className="glass-card h-80 p-5"><div className="section-title mb-3"><TrendingUp size={16} className="text-cyan-500" /> How this area developed</div>
              <ResponsiveContainer height="85%"><BarChart data={timeline}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: "#0f172a", color: "#fff", border: "none" }} />
                <Bar dataKey="papers" stackId="a" fill="#06B6D4" name="Papers" /><Bar dataKey="patents" stackId="a" fill="#F59E0B" name="Patents" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>))}
        </>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && <div><div className="flex items-center gap-2"><Label tone="fact">{open.kind}</Label><span className="text-xs text-ink-mute">{open.item.source} · {open.item.year}</span></div>
        <h2 className="mt-1.5 text-lg font-bold leading-snug">{open.item.title}</h2><div className="text-xs text-ink-mute">{open.item.authors_or_owner}</div></div>}>
        {open && <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><ExtLink href={open.item.url}>Open source record</ExtLink>{open.item.meta?.oa_url && <ExtLink href={open.item.meta.oa_url}>Open-access PDF</ExtLink>}
            <button className="btn-outline !py-1 text-xs" onClick={() => toggleSave(open)}>{open.saved ? <BookmarkCheck size={13} /> : <Plus size={13} />} {open.saved ? "Saved" : "Save to library"}</button></div>
          <SummaryCard item={open.item} projectId={project.id} />
          <div><div className="mb-2 flex items-center gap-2"><Label tone="fact">Retrieved abstract</Label></div>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed dark:bg-white/[.04]">{open.item.text}</p></div>
          <div className="text-[11px] text-ink-mute">Retrieved {open.item.fetched_at || "from the local collection"} · id {open.item.id}</div>
        </div>}
      </Drawer>
    </div>
  );
}
