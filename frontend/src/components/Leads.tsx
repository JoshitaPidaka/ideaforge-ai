import clsx from "clsx";
import { motion } from "framer-motion";
import { BookMarked, ExternalLink, Filter, LayoutGrid, Rows3, Star, StickyNote, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Analysis, Lead, ReviewState } from "../lib/api";
import { useApp } from "../lib/store";
import { SummaryCard } from "./SummaryCard";
import { Drawer, Empty, LevelBadge, OverlapMeter, Quote, Term, TypeBadge, Verified } from "./ui";

const REL_STYLE: Record<string, string> = {
  same: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  similar: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  different: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  unknown: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
  covers: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  partially_covers: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  does_not_cover: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const leadLevel = (l: Lead) => l.report?.overlap_level ?? (l.similarity > 0.42 ? "medium" : "low");

export function ReviewButtons({ lead, onReview, compact }: { lead: Lead; onReview: (s: ReviewState, note?: string) => void; compact?: boolean }) {
  const btn = (s: ReviewState, icon: React.ReactNode, label: string, on: string) => (
    <button onClick={(e) => { e.stopPropagation(); onReview(lead.review === s ? "unreviewed" : s); }} aria-pressed={lead.review === s} title={label}
      className={clsx("chip py-1 ring-1 transition", lead.review === s ? on : "bg-white ring-slate-200 hover:ring-brand-300 dark:bg-white/5 dark:ring-white/10")}>
      {icon}{!compact && label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {btn("relevant", <ThumbsUp size={12} />, "Relevant", "bg-emerald-600 text-white ring-emerald-600")}
      {btn("not_relevant", <ThumbsDown size={12} />, "Not relevant", "bg-slate-600 text-white ring-slate-600")}
      {btn("needs_reading", <BookMarked size={12} />, "Needs reading", "bg-sky-600 text-white ring-sky-600")}
    </div>
  );
}

function LeadMeta({ lead }: { lead: Lead }) {
  const it = lead.item;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute dark:text-slate-400">
      <TypeBadge type={it.type} />
      {it.year && <span>{it.year}</span>}
      {it.venue_or_language && <span className="truncate">{it.venue_or_language}</span>}
      {it.meta?.stars != null && <span className="flex items-center gap-0.5"><Star size={11} /> {Number(it.meta.stars).toLocaleString()}</span>}
      {it.meta?.citations != null && <span>{it.meta.citations} citations</span>}
      <span className="font-mono">sim {lead.similarity.toFixed(2)}</span>
    </div>
  );
}

export function LeadCard({ lead, analysis, onOpen, onReview, i }: { lead: Lead; analysis: Analysis; onOpen: () => void; onReview: (s: ReviewState) => void; i: number }) {
  const { simple } = useApp();
  const rep = lead.report;
  const quote = rep?.aspects.find((a) => a.verified && a.evidence_quote) || rep?.contribution_matches.find((m) => m.verified && m.evidence_quote);
  const matched = rep ? rep.contribution_matches.filter((m) => m.relation !== "does_not_cover").map((m) => m.contribution_index) : lead.matched_contributions;
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
      onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={clsx("card group flex cursor-pointer flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-glow",
        lead.review === "not_relevant" && "opacity-55")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-mono text-ink-mute">#{lead.rank}</div>
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-200">{lead.item.title}</h3>
        </div>
        <div className="flex flex-col items-end gap-1.5"><OverlapMeter level={leadLevel(lead)} /><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{rep ? leadLevel(lead) : "est."}</span></div>
      </div>
      <LeadMeta lead={lead} />
      {rep ? (
        <p className="text-sm text-ink-soft dark:text-slate-300"><span className="font-semibold text-ink dark:text-white">Key difference: </span>{simple && rep.simple_summary ? rep.simple_summary : rep.key_difference}</p>
      ) : <p className="line-clamp-3 text-sm text-ink-soft dark:text-slate-300">{lead.item.text.slice(0, 260)}…</p>}
      {quote && <div><Quote text={quote.evidence_quote} ok /></div>}
      {matched.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matched.map((c) => <span key={c} className="chip bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200" title={analysis.brief.contributions[c]}>C{c + 1}</span>)}
          <span className="text-[11px] text-ink-mute">matches contribution{matched.length > 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
        <ReviewButtons lead={lead} onReview={onReview} compact />
        {lead.note && <StickyNote size={14} className="text-amber-500" aria-label="Has note" />}
      </div>
    </motion.article>
  );
}

function highlight(text: string, quotes: string[]) {
  const spans: [number, number][] = [];
  const low = text.toLowerCase();
  for (const q of quotes) {
    const k = q.toLowerCase().replace(/^["'\s.]+|["'\s.]+$/g, "");
    const i = k.length > 10 ? low.indexOf(k) : -1;
    if (i >= 0) spans.push([i, i + k.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach(([s, e], n) => { if (s < pos) return; out.push(text.slice(pos, s)); out.push(<mark key={n} className="evidence">{text.slice(s, e)}</mark>); pos = e; });
  out.push(text.slice(pos));
  return out;
}

export function LeadDrawer({ lead, analysis, onClose, onReview }: { lead: Lead | null; analysis: Analysis; onClose: () => void; onReview: (s: ReviewState, note?: string) => void }) {
  const { simple } = useApp();
  const [note, setNote] = useState("");
  const rep = lead?.report;
  const quotes = rep ? [...rep.aspects, ...rep.contribution_matches].filter((x) => x.verified).map((x) => x.evidence_quote) : [];
  return (
    <Drawer open={!!lead} onClose={onClose} title={lead && (
      <div>
        <LeadMeta lead={lead} />
        <h2 className="mt-1.5 text-lg font-bold leading-snug">{lead.item.title}</h2>
        <div className="mt-1 text-xs text-ink-mute">{lead.item.authors_or_owner}</div>
      </div>
    )}>
      {lead && (
        <div className="space-y-6" key={lead.item.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReviewButtons lead={lead} onReview={(s) => onReview(s, lead.note)} />
            <a href={lead.item.url} target="_blank" rel="noreferrer" className="btn-outline !py-1.5 text-xs">Open original <ExternalLink size={13} /></a>
          </div>

          {rep ? (
            <>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="mb-2 flex items-center gap-2"><LevelBadge level={rep.overlap_level} /><span className="text-xs text-ink-mute">Possible overlap: a <Term k="lead">lead</Term> for your review</span></div>
                <p className="text-sm leading-relaxed">{simple && rep.simple_summary ? rep.simple_summary : rep.summary}</p>
                <p className="mt-2 text-sm"><b>Key difference:</b> {rep.key_difference}</p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Structured comparison</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                  {rep.aspects.map((a) => (
                    <div key={a.aspect} className="grid grid-cols-[96px_1fr] gap-3 border-b border-slate-100 p-3 last:border-0 dark:border-white/5">
                      <div><div className="text-xs font-semibold capitalize">{a.aspect}</div><span className={clsx("chip mt-1", REL_STYLE[a.relation])}>{a.relation}</span></div>
                      <div className="min-w-0 text-sm">{a.explanation}{a.evidence_quote && <><Quote text={a.evidence_quote} ok={a.verified} /><div className="mt-1"><Verified ok={a.verified} /></div></>}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Your contributions vs this lead</h3>
                <div className="space-y-2">
                  {analysis.brief.contributions.map((c, ci) => {
                    const m = rep.contribution_matches.find((x) => x.contribution_index === ci);
                    return (
                      <div key={ci} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                        <div className="flex items-start justify-between gap-3 text-sm"><span><b className="text-brand-600">C{ci + 1}</b> {c}</span>
                          <span className={clsx("chip shrink-0", REL_STYLE[m?.relation || "does_not_cover"])}>{(m?.relation || "does_not_cover").replace(/_/g, " ")}</span></div>
                        {m?.evidence_quote && <Quote text={m.evidence_quote} ok={m.verified} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              This lead was found by semantic search (similarity {lead.similarity.toFixed(2)}). Connect Gemma 4 to get a structured comparison with verified quotes.
            </div>
          )}

          <SummaryCard item={lead.item} />

          <div>
            <h3 className="mb-2 font-semibold">Source text {quotes.length > 0 && <span className="text-xs font-normal text-ink-mute">· verified quotes highlighted</span>}</h3>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-[13px] leading-relaxed text-ink-soft dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {highlight(lead.item.text, quotes)}
            </div>
          </div>

          <div>
            <label className="mb-2 block font-semibold" htmlFor="note">Reviewer note</label>
            <textarea id="note" className="input min-h-[80px]" placeholder="e.g. Same dataset, but they don't support offline use" defaultValue={lead.note}
              onChange={(e) => setNote(e.target.value)} onBlur={() => note && onReview(lead.review, note)} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

export function LeadsView({ analysis, onReview }: { analysis: Analysis; onReview: (leadId: string, s: ReviewState, note?: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [review, setReview] = useState("");
  const [contrib, setContrib] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const leads = useMemo(() => analysis.leads.filter((l) =>
    (!type || l.item.type === type) && (!level || leadLevel(l) === level) && (!review || l.review === review) &&
    (!contrib || (l.report ? l.report.contribution_matches.some((m) => m.contribution_index === +contrib && m.relation !== "does_not_cover") : l.matched_contributions.includes(+contrib)))
  ), [analysis.leads, type, level, review, contrib]);
  const lead = analysis.leads.find((l) => l.item.id === open) || null;
  const sel = "input !w-auto !py-1.5 text-xs";

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Filter size={15} className="ml-1 text-ink-mute" />
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option><option value="paper">Papers</option><option value="project">Projects</option></select>
        <select className={sel} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Overlap"><option value="">Any overlap</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select className={sel} value={review} onChange={(e) => setReview(e.target.value)} aria-label="Review state"><option value="">Any review state</option><option value="unreviewed">Unreviewed</option><option value="relevant">Relevant</option><option value="needs_reading">Needs reading</option><option value="not_relevant">Not relevant</option></select>
        <select className={clsx(sel, "max-w-[220px]")} value={contrib} onChange={(e) => setContrib(e.target.value)} aria-label="Contribution"><option value="">Any contribution</option>{analysis.brief.contributions.map((c, i) => <option key={i} value={i}>C{i + 1}: {c.slice(0, 40)}</option>)}</select>
        <span className="ml-auto text-xs text-ink-mute">{leads.length} of {analysis.leads.length} leads</span>
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/5">
          <button className={clsx("rounded-md p-1.5", view === "cards" && "bg-white shadow-sm dark:bg-white/10")} onClick={() => setView("cards")} aria-label="Card view"><LayoutGrid size={15} /></button>
          <button className={clsx("rounded-md p-1.5", view === "table" && "bg-white shadow-sm dark:bg-white/10")} onClick={() => setView("table")} aria-label="Table view"><Rows3 size={15} /></button>
        </div>
      </div>
      {leads.length === 0 ? <Empty title="No leads match these filters">Clear a filter, or go back and add keywords to the brief.</Empty> : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((l, i) => <LeadCard key={l.item.id} i={i} lead={l} analysis={analysis} onOpen={() => setOpen(l.item.id)} onReview={(s) => onReview(l.item.id, s, l.note)} />)}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-mute"><tr>{["#", "Title", "Type", "Year", "Overlap", "Similarity", "Review"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{leads.map((l) => (
              <tr key={l.item.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5" onClick={() => setOpen(l.item.id)}>
                <td className="px-4 py-2.5 font-mono text-xs">{l.rank}</td><td className="max-w-xs truncate px-4 font-medium">{l.item.title}</td>
                <td className="px-4"><TypeBadge type={l.item.type} /></td><td className="px-4">{l.item.year ?? ""}</td>
                <td className="px-4"><OverlapMeter level={leadLevel(l)} /></td><td className="px-4 font-mono text-xs">{l.similarity.toFixed(2)}</td>
                <td className="px-4 text-xs capitalize">{l.review.replace("_", " ")}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <LeadDrawer lead={lead} analysis={analysis} onClose={() => setOpen(null)} onReview={(s, n) => lead && onReview(lead.item.id, s, n)} />
    </div>
  );
}
