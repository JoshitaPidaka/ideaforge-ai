import { motion } from "framer-motion";
import { Database, ExternalLink, Loader2, Search, Sparkles, Star, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Shell } from "../components/Layout";
import { SummaryCard } from "../components/SummaryCard";
import { Drawer, Empty, ErrorBox, Section, Skeleton, Term, TypeBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/store";

type Row = Awaited<ReturnType<typeof api.items>>["items"][number];

export default function CollectionPage() {
  const { collection, setCollection, refreshHealth } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Row | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [up, setUp] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => { setStats(null); api.collection(collection).then(setStats).catch(setError); }, [collection]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api.items(collection, q, type).then((r) => { setRows(r.items); setTotal(r.total); }).catch(setError).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [collection, q, type]);

  const upload = async (f: File) => {
    const fd = new FormData(); fd.append("file", f); fd.append("name", name || f.name.replace(/\.\w+$/, ""));
    setUp({ busy: true, msg: "" });
    try { const r = await api.uploadCollection(fd); setUp({ busy: false, msg: `Added “${r.name}” with ${r.items} items${r.skipped ? ` (${r.skipped} rows skipped)` : ""}.` }); refreshHealth(); setCollection(r.name); }
    catch (e) { setUp({ busy: false, msg: (e as ApiError).message }); }
  };

  const COLORS = ["#0284C7", "#7C3AED", "#F59E0B", "#10B981"];
  return (
    <Shell>
      <div className="mb-6 mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Database className="text-brand-600" /> The <Term k="bounded collection">bounded collection</Term></h1>
          <p className="text-sm text-ink-mute dark:text-slate-400">Every search runs only inside this fixed set of papers and project descriptions, so you always know what was checked.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <div className="grid gap-4 md:grid-cols-4">
        {!stats ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />) : <>
          <div className="card flex flex-col justify-center p-5"><div className="label">Items</div><div className="mt-1 text-4xl font-extrabold gradient-text">{stats.total}</div>
            <div className="mt-1 text-xs text-ink-mute">{stats.by_type.paper ?? 0} papers · {stats.by_type.project ?? 0} projects</div><div className="mt-2 truncate text-[11px] text-ink-mute" title={stats.embedder}>Index: {stats.embedder}</div></div>
          <div className="card p-4"><div className="label">By source</div>
            <div className="h-24"><ResponsiveContainer><PieChart><Pie data={Object.entries(stats.by_source).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" innerRadius={26} outerRadius={42} paddingAngle={3}>
              {Object.keys(stats.by_source).map((k, i) => <Cell key={k} fill={COLORS[i % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="flex flex-wrap gap-2 text-[11px]">{Object.entries(stats.by_source).map(([k, v], i) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % 4] }} />{k} {String(v)}</span>)}</div></div>
          <div className="card p-4 md:col-span-2"><div className="label">{stats.years.length ? "By year" : "Top tags"}</div>
            <div className="h-28">{stats.years.length ? <ResponsiveContainer><BarChart data={stats.years}><XAxis dataKey="year" tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
              : <div className="flex flex-wrap gap-1.5 pt-2">{stats.top_tags.slice(0, 14).map((t: any) => <span key={t.tag} className="chip bg-slate-100 dark:bg-white/10">{t.tag}</span>)}{stats.top_tags.length === 0 && <span className="text-xs text-ink-mute">Run the collection builder with API access to add years, stars and topics.</span>}</div>}</div></div>
        </>}
      </div>
      {stats && !stats.by_type.paper && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">This collection has no papers yet. Run <code className="font-mono">python scripts/build_collection.py</code> with internet access to add OpenAlex and arXiv papers.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section title="Browse & search" sub={`${total} items${q ? ` matching “${q}” (semantic + keyword search)` : ""}. Open any project for an ✨ AI summary.`}>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" /><input className="input !pl-9" placeholder="Search the collection, e.g. “offline plant disease app”" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All</option><option value="paper">Papers</option><option value="project">Projects</option></select>
          </div>
          {loading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
            : rows.length === 0 ? <Empty title="Nothing found">Try different words.</Empty> : (
              <div className="grid gap-3 sm:grid-cols-2">{rows.map((r, i) => (
                <motion.button key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} onClick={() => setSel(r)}
                  className="card flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glow">
                  <div className="flex items-center justify-between gap-2"><TypeBadge type={r.type} />{r.has_summary && <span className="chip bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><Sparkles size={11} /> AI summary</span>}</div>
                  <div className="line-clamp-1 font-semibold capitalize">{r.title}</div>
                  <div className="line-clamp-2 text-xs text-ink-mute dark:text-slate-400">{r.snippet}</div>
                  <div className="mt-auto flex gap-3 text-[11px] text-ink-mute">{r.authors_or_owner && <span className="truncate">{r.authors_or_owner}</span>}{r.year && <span>{r.year}</span>}{r.meta?.stars != null && <span className="flex items-center gap-0.5"><Star size={10} />{r.meta.stars}</span>}</div>
                </motion.button>))}</div>
            )}
        </Section>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="mb-1 flex items-center gap-2 font-semibold"><Upload size={16} className="text-brand-600" /> Use your own collection</div>
            <p className="mb-3 text-xs text-ink-mute">Upload your department's past projects or a reading list (CSV, JSON or BibTeX). Columns: <code>title</code>, <code>abstract</code> or <code>description</code>, plus optional <code>type, year, url, authors, tags</code>.</p>
            <input className="input mb-2" placeholder="Collection name, e.g. cse-2025-projects" value={name} onChange={(e) => setName(e.target.value)} />
            <input ref={fileRef} type="file" hidden accept=".csv,.json,.jsonl,.bib" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn-primary w-full" disabled={up.busy} onClick={() => fileRef.current?.click()}>{up.busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload file</button>
            {up.msg && <p className="mt-2 text-xs">{up.msg}</p>}
          </div>
          <div className="card p-5 text-sm">
            <div className="mb-2 font-semibold">Why a bounded collection?</div>
            <ul className="list-disc space-y-1 pl-4 text-xs text-ink-mute dark:text-slate-400">
              <li>Results are reproducible: the same proposal gives the same leads.</li>
              <li>"No match" means "no match <i>in this collection</i>", never "nothing exists".</li>
              <li>Colleges can check proposals against their own past projects.</li>
            </ul>
          </div>
        </aside>
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel && <div><TypeBadge type={sel.type} /><h2 className="mt-1.5 text-lg font-bold capitalize">{sel.title}</h2><div className="text-xs text-ink-mute">{sel.authors_or_owner}</div></div>}>
        {sel && <div className="space-y-5">
          <a className="btn-outline !py-1.5 text-xs" href={sel.url} target="_blank" rel="noreferrer">Open on {sel.type === "project" ? "GitHub" : "publisher"} <ExternalLink size={13} /></a>
          <SummaryCard item={sel} />
          <div><div className="label mb-2">Source text excerpt</div><p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed dark:bg-white/5">{sel.snippet}…</p></div>
        </div>}
      </Drawer>
    </Shell>
  );
}
