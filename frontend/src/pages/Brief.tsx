import { motion, Reorder } from "framer-motion";
import { ArrowRight, Cpu, GripVertical, Image as ImageIcon, Loader2, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout";
import { Empty, ErrorBox, Skeleton, Term } from "../components/ui";
import { api, ApiError, type Brief } from "../lib/api";
import { useApp } from "../lib/store";

const FIELDS: [keyof Brief, string][] = [
  ["problem", "Problem"], ["target_users", "Target users"], ["method", "Method / approach"],
  ["data", "Data"], ["platform", "Platform & stack"], ["expected_outcome", "Expected outcome"],
];

export default function BriefPage() {
  const nav = useNavigate();
  const { draft, setDraft, collection } = useApp();
  const [brief, setBrief] = useState<Brief | null>(draft?.brief ?? null);
  const [error, setError] = useState<ApiError | null>(null);
  const [starting, setStarting] = useState(false);
  const [kw, setKw] = useState("");
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);

  const load = () => {
    if (!draft) return;
    setError(null);
    api.brief(draft.proposalId).then((b) => { setBrief(b); setDraft({ ...draft, brief: b }); }).catch(setError);
  };
  useEffect(() => { if (draft && !draft.brief) load(); }, []); // eslint-disable-line
  useEffect(() => { if (brief) setItems(brief.contributions.map((t, i) => ({ id: i + Math.random(), text: t }))); }, [brief?.contributions.join("|")]); // eslint-disable-line

  if (!draft) return <Shell step={1}><Empty title="No proposal yet">Start from the home page by uploading or pasting a proposal. <button className="btn-primary mt-4" onClick={() => nav("/")}>Go to start</button></Empty></Shell>;

  const update = (patch: Partial<Brief>) => brief && setBrief({ ...brief, ...patch });
  const contributions = items.map((i) => i.text).filter((t) => t.trim());

  async function start() {
    if (!brief || !draft) return;
    setStarting(true); setError(null);
    const b = { ...brief, contributions };
    try {
      setDraft({ ...draft, brief: b });
      const { id } = await api.startAnalysis(draft.proposalId, collection, b);
      nav(`/analysis/${id}`);
    } catch (e) { setError(e as ApiError); setStarting(false); }
  }

  return (
    <Shell step={1}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Check your proposal brief</h1>
          <p className="text-sm text-ink-mute dark:text-slate-400">Fix anything that's wrong. Each <Term k="contribution" /> is checked separately against the collection.</p>
        </div>
        {brief && (brief.generated_by === "gemma"
          ? <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200"><Cpu size={12} /> Extracted by Gemma 4</span>
          : <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300">Quick extraction (AI offline): please review</span>)}
      </div>
      <ErrorBox error={error} onRetry={brief ? undefined : load} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left: preview + figures */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="label mb-2">Your proposal · {draft.name}</div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-soft dark:text-slate-300">{draft.preview}</pre>
          </div>
          <div className="card p-5">
            <div className="label mb-3 flex items-center gap-1.5"><ImageIcon size={13} /> Figures read by Gemma 4 <span className="chip bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">multimodal</span></div>
            {draft.figures.length === 0 ? <p className="text-sm text-ink-mute">No figures found. Upload a PDF or DOCX with diagrams to see Gemma describe them.</p> : (
              <div className="grid grid-cols-2 gap-3">
                {draft.figures.map((src, i) => (
                  <figure key={src} className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <img src={src} alt={`Figure ${i + 1}`} className="h-28 w-full bg-slate-50 object-contain" />
                    <figcaption className="p-2 text-[11px] text-ink-soft dark:text-slate-300">
                      {brief?.figure_insights.find((f) => f.figure === i + 1)?.description || (brief ? "No description" : "Reading…")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* right: editable brief */}
        <section className="space-y-4">
          {!brief ? (
            <div className="card space-y-4 p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-200"><Loader2 size={16} className="animate-spin" /> Gemma is reading your proposal…</div>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5">
                <label className="label" htmlFor="title">Project title</label>
                <input id="title" className="input mt-1 !text-base font-semibold" value={brief.title} onChange={(e) => update({ title: e.target.value })} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {FIELDS.map(([k, l]) => (
                    <div key={k}>
                      <label className="label" htmlFor={k}>{l}</label>
                      <textarea id={k} rows={3} className="input mt-1 resize-y text-[13px]" value={brief[k] as string} onChange={(e) => update({ [k]: e.target.value } as Partial<Brief>)} />
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="card p-5">
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-semibold">Claimed contributions <span className="text-ink-mute">({contributions.length})</span></div>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => setItems([...items, { id: Math.random(), text: "" }])}><Plus size={14} /> Add</button>
                </div>
                <p className="mb-3 text-xs text-ink-mute">Drag to reorder. Make each one specific, e.g. "Offline detection on low-end Android phones".</p>
                <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
                  {items.map((it, i) => (
                    <Reorder.Item key={it.id} value={it} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
                      <GripVertical size={16} className="cursor-grab text-slate-400" />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{i + 1}</span>
                      <input className="flex-1 bg-transparent text-sm focus:outline-none" value={it.text} placeholder="Describe one contribution…" aria-label={`Contribution ${i + 1}`}
                        onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))} />
                      <button className="btn-ghost !p-1.5" aria-label="Remove contribution" onClick={() => setItems(items.filter((x) => x.id !== it.id))}><Trash2 size={14} /></button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>

              <div className="card p-5">
                <div className="mb-2 font-semibold">Search keywords</div>
                <div className="flex flex-wrap gap-2">
                  {brief.keywords.map((k) => (
                    <span key={k} className="chip bg-slate-100 py-1 text-ink-soft dark:bg-white/10 dark:text-slate-200">{k}
                      <button aria-label={`Remove ${k}`} onClick={() => update({ keywords: brief.keywords.filter((x) => x !== k) })}><X size={12} /></button></span>
                  ))}
                  <form onSubmit={(e) => { e.preventDefault(); if (kw.trim()) { update({ keywords: [...brief.keywords, kw.trim()] }); setKw(""); } }}>
                    <input className="input !w-36 !py-1 text-xs" placeholder="+ add keyword" value={kw} onChange={(e) => setKw(e.target.value)} />
                  </form>
                </div>
              </div>

              <div className="sticky bottom-4 z-10 flex justify-end">
                <button className="btn-primary px-6 py-3 text-base" disabled={starting || contributions.length === 0} onClick={start}>
                  {starting ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Find related work <ArrowRight size={18} />
                </button>
              </div>
              {contributions.length === 0 && <p className="text-right text-xs text-rose-600"><Sparkles size={12} className="inline" /> Add at least one contribution.</p>}
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
