import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronDown, Copy, Gavel, Grid3x3, Lightbulb, Megaphone, Puzzle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Analysis, Indicator } from "../lib/api";
import { useApp } from "../lib/store";
import { leadLevel } from "./Leads";
import { Empty, LevelBadge, LEVEL_STYLE, Section, Term } from "./ui";

const IND_COLOR: Record<string, Record<string, string>> = {
  Overlap: { high: "#E11D48", medium: "#D97706", low: "#059669" },
  Coverage: { high: "#4F46E5", medium: "#6366F1", low: "#94A3B8" },
  Confidence: { high: "#059669", medium: "#D97706", low: "#94A3B8" },
};

function Ring({ value, color }: { value: number; color: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-white/10" />
      <motion.circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke={color}
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0.04, value)) }} transition={{ duration: 1, ease: "easeOut" }} />
    </svg>
  );
}

function IndicatorTile({ ind, k }: { ind: Indicator; k: string }) {
  const color = IND_COLOR[ind.label]?.[ind.level] ?? "#6366F1";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4 p-5">
      <div className="relative"><Ring value={ind.value} color={color} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase" style={{ color }}>{ind.level}</span></div>
      <div className="min-w-0">
        <div className="text-sm font-bold"><Term k={k}>{ind.label}</Term></div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-mute dark:text-slate-400">{ind.explanation}</p>
      </div>
    </motion.div>
  );
}

function Heatmap({ a, onOpen }: { a: Analysis; onOpen?: (id: string) => void }) {
  const leads = a.leads.slice(0, 10);
  const cell = (ci: number, li: number) => {
    const l = leads[li];
    if (l.report) {
      const m = l.report.contribution_matches.find((x) => x.contribution_index === ci);
      if (!m || m.relation === "does_not_cover") return { v: 0, t: "does not cover" };
      return { v: m.relation === "covers" ? (m.verified ? 3 : 1) : (m.verified ? 2 : 1), t: `${m.relation.replace("_", " ")}${m.verified ? " · verified" : " · unverified"}` };
    }
    return l.matched_contributions.includes(ci) ? { v: 1, t: "retrieval match (no AI check)" } : { v: 0, t: "no match" };
  };
  const bg = ["bg-slate-50 dark:bg-white/[.03]", "bg-brand-100 dark:bg-brand-500/20", "bg-amber-300/80 dark:bg-amber-500/50", "bg-rose-500/85 dark:bg-rose-500/70"];
  return (
    <div className="card overflow-x-auto p-4">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead><tr><th className="w-56 text-left font-semibold text-ink-mute">Contribution ↓ · Lead →</th>
          {leads.map((l) => <th key={l.item.id} className="min-w-[44px] p-0 align-bottom"><button onClick={() => onOpen?.(l.item.id)} title={l.item.title}
            className="mx-auto block h-24 max-w-[44px] truncate text-left font-medium text-ink-soft [writing-mode:vertical-rl] rotate-180 hover:text-brand-600 dark:text-slate-300">{l.item.title}</button></th>)}</tr></thead>
        <tbody>{a.brief.contributions.map((c, ci) => (
          <tr key={ci}><td className="max-w-[14rem] truncate pr-2 font-medium" title={c}><b className="text-brand-600">C{ci + 1}</b> {c}</td>
            {leads.map((l, li) => { const x = cell(ci, li); return <td key={l.item.id} title={`${l.item.title}: ${x.t}`} className={clsx("h-9 rounded-md transition hover:ring-2 hover:ring-brand-400", bg[x.v])} />; })}
          </tr>))}</tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-mute">
        {["No overlap", "Weak / unverified", "Partially covers (verified)", "Covers (verified)"].map((t, i) => <span key={t} className="flex items-center gap-1.5"><span className={clsx("h-3 w-3 rounded", bg[i])} />{t}</span>)}
      </div>
    </div>
  );
}

export function InsightsView({ a, onOpenLead, toast }: { a: Analysis; onOpenLead: (id: string) => void; toast: (m: string) => void }) {
  const { simple } = useApp();
  const ins = a.insight;
  const [openQ, setOpenQ] = useState<number | null>(0);
  if (!ins) return <Empty title="No insights yet">The analysis has not produced insights.</Empty>;
  const title = (id: string) => a.leads.find((l) => l.item.id === id)?.item.title ?? id;

  return (
    <div className="space-y-10">
      {(ins.headline || ins.simple_summary) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 p-6 text-white shadow-glow">
          <div className="grid-bg absolute inset-0 opacity-20" />
          <div className="relative text-xs font-semibold uppercase tracking-wider opacity-80">The big picture</div>
          <p className="relative mt-1 text-lg font-semibold leading-snug">{simple && ins.simple_summary ? ins.simple_summary : ins.headline}</p>
        </motion.div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <IndicatorTile ind={ins.overlap} k="overlap" /><IndicatorTile ind={ins.coverage} k="coverage" /><IndicatorTile ind={ins.confidence} k="confidence" />
      </div>
      <p className="-mt-6 text-center text-xs text-ink-mute">No single "novelty %": three separate indicators, because a low number of matches is not proof that an idea is new.</p>

      <Section title="Contribution by contribution" icon={<Puzzle size={18} className="text-brand-600" />} sub="How much existing work in the collection already does each thing you claim.">
        <div className="grid gap-3 md:grid-cols-2">
          {ins.contributions.map((c) => (
            <motion.div key={c.index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: c.index * 0.05 }}
              className={clsx("card border-l-4 p-4", c.overlap_level === "high" ? "border-l-hi" : c.overlap_level === "medium" ? "border-l-mid" : "border-l-lo")}>
              <div className="flex items-start justify-between gap-3"><div className="font-semibold"><span className="text-brand-600">C{c.index + 1}</span> {c.contribution}</div><LevelBadge level={c.overlap_level} /></div>
              {(c.explanation || c.simple) && <p className="mt-2 text-sm text-ink-soft dark:text-slate-300">{simple && c.simple ? c.simple : c.explanation}</p>}
              {c.supporting_leads.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">{c.supporting_leads.slice(0, 4).map((id) => (
                  <button key={id} onClick={() => onOpenLead(id)} className="chip max-w-[200px] truncate bg-slate-100 text-ink-soft hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-slate-300">{title(id)}</button>))}
                  {c.supporting_leads.length > 4 && <span className="text-xs text-ink-mute">+{c.supporting_leads.length - 4}</span>}</div>
              ) : <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">No supporting leads found in this collection. This looks like a possible differentiator; verify it with a wider search.</p>}
            </motion.div>
          ))}
        </div>
      </Section>

      <Section title="Structured comparison matrix" icon={<Grid3x3 size={18} className="text-brand-600" />} sub="Your contributions (rows) against the top leads (columns). Click a lead name to open its evidence.">
        <Heatmap a={a} onOpen={onOpenLead} />
      </Section>

      {(ins.gaps.length > 0 || ins.ideas.length > 0) && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Section title="Gaps nobody covers" icon={<Puzzle size={18} className="text-emerald-600" />}>
            <div className="space-y-3">{ins.gaps.map((g) => (
              <div key={g.title} className="card p-4"><div className="font-semibold">{g.title}</div><p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{g.detail}</p>
                {g.checked_leads.length > 0 && <p className="mt-2 text-[11px] text-ink-mute">Checked against: {g.checked_leads.map(title).join(" · ")}</p>}</div>))}</div>
          </Section>
          <Section title="Ideas to stand out" icon={<Lightbulb size={18} className="text-amber-500" />}>
            <div className="space-y-3">{ins.ideas.map((i) => (
              <div key={i.title} className="card p-4"><div className="flex items-start justify-between gap-2"><div className="font-semibold">{i.title}</div>
                <span className={clsx("chip shrink-0", i.effort === "low" ? LEVEL_STYLE.low.bg : i.effort === "medium" ? LEVEL_STYLE.medium.bg : LEVEL_STYLE.high.bg)}>{i.effort} effort</span></div>
                <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{i.detail}</p></div>))}</div>
          </Section>
        </div>
      )}

      {ins.pitch_line && (
        <Section title="Your pitch line" icon={<Megaphone size={18} className="text-violet-600" />}>
          <div className="card flex items-center gap-4 border-violet-200 bg-gradient-to-r from-violet-50 to-white p-5 dark:border-violet-500/30 dark:from-violet-500/10 dark:to-transparent">
            <p className="flex-1 text-lg font-semibold italic">“{ins.pitch_line}”</p>
            <button className="btn-outline" onClick={() => { navigator.clipboard?.writeText(ins.pitch_line); toast("Pitch line copied"); }}><Copy size={15} /> Copy</button>
          </div>
        </Section>
      )}

      {ins.judge_questions.length > 0 && (
        <Section title="Judge & viva question prep" icon={<Gavel size={18} className="text-brand-600" />} sub="Questions an evaluator is likely to ask, given the overlaps found.">
          <div className="card divide-y divide-slate-100 dark:divide-white/5">
            {ins.judge_questions.map((q, i) => (
              <div key={i}>
                <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-medium" onClick={() => setOpenQ(openQ === i ? null : i)} aria-expanded={openQ === i}>
                  {q.question}<ChevronDown size={16} className={clsx("shrink-0 transition", openQ === i && "rotate-180")} /></button>
                {openQ === i && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-4 text-sm text-ink-soft dark:text-slate-300">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">Suggested answer: </span>{q.suggested_answer}
                  {q.related_lead && <button className="ml-2 text-xs font-semibold text-brand-600 hover:underline" onClick={() => onOpenLead(q.related_lead)}>View lead →</button>}
                </motion.div>}
              </div>))}
          </div>
        </Section>
      )}

      {a.timeline.length > 1 && (
        <Section title="Is this area crowded or growing?" icon={<TrendingUp size={18} className="text-brand-600" />} sub="Related items in the collection by year (top 40 most similar).">
          <div className="card h-64 p-4">
            <ResponsiveContainer>
              <BarChart data={a.timeline}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="paper" stackId="a" fill="#0284C7" name="Papers" radius={[0, 0, 0, 0]} /><Bar dataKey="project" stackId="a" fill="#7C3AED" name="Projects" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-ink-mute">
        <span>Overlap levels of leads: </span>{(["high", "medium", "low"] as const).map((lv) => <span key={lv}>{lv}: {a.leads.filter((l) => leadLevel(l) === lv).length}</span>)}
      </div>
    </div>
  );
}
