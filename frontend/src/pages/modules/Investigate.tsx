import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChevronDown, Crosshair, Download, Radar } from "lucide-react";
import { useMemo, useState } from "react";
import { Busy } from "../../components/kit";
import { Empty } from "../../components/ui";
import type { Analysis } from "../../lib/api";
import { useProject } from "../Workspace";
import { useProjectData } from "./hooks";

export interface Row {
  index: number; contribution: string; level: "high" | "medium" | "low"; score: number; leads: { id: string; title: string; type: string; relation: string; verified: boolean; sim: number }[];
  verified: number; quotes: number; confidence: "High" | "Medium" | "Low"; explanation: string;
}

export function rankContributions(a: Analysis): Row[] {
  const ins = a.insight!;
  return ins.contributions.map((c) => {
    const leads = a.leads.flatMap((l) => (l.report?.contribution_matches || []).filter((m) => m.contribution_index === c.index && m.relation !== "does_not_cover")
      .map((m) => ({ id: l.item.id, title: l.item.title, type: l.item.type, relation: m.relation, verified: m.verified, sim: l.similarity })));
    const verified = leads.filter((l) => l.verified).length;
    const quotes = a.leads.reduce((n, l) => n + (l.report?.contribution_matches.filter((m) => m.contribution_index === c.index && m.evidence_quote).length ?? 0), 0);
    const confidence: Row["confidence"] = verified >= 3 ? "High" : verified >= 1 ? "Medium" : "Low";
    return { index: c.index, contribution: c.contribution, level: c.overlap_level, score: c.score, leads, verified, quotes, confidence, explanation: c.explanation };
  }).sort((x, y) => y.score - x.score);
}

export const LEVEL_TXT = { high: "text-rose-500 dark:text-rose-400", medium: "text-amber-600 dark:text-amber-400", low: "text-emerald-600 dark:text-emerald-400" };
export const LEVEL_BAR = { high: "bg-rose-500", medium: "bg-amber-500", low: "bg-emerald-500" };
export function Conf({ c }: { c: string }) {
  return <span className={clsx("conf", c === "High" ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : c === "Medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-500")}>
    <span className="flex items-end gap-px">{[1, 2, 3].map((i) => <span key={i} className={clsx("w-[3px] rounded-sm bg-current", i === 1 ? "h-1.5" : i === 2 ? "h-2" : "h-2.5", (c === "Low" && i > 1) || (c === "Medium" && i > 2) ? "opacity-25" : "")} />)}</span>{c}</span>;
}

export default function InvestigateView() {
  const { project, go } = useProject();
  const { analysis, loaded } = useProjectData(project);
  const rows = useMemo(() => (analysis?.insight ? rankContributions(analysis) : []), [analysis]);
  const [open, setOpen] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.score));

  const csv = () => {
    const lines = [["rank", "contribution", "overlap", "score", "supporting_leads", "verified_quotes", "confidence"].join(","),
      ...rows.map((r, i) => [i + 1, `"${r.contribution.replace(/"/g, "'")}"`, r.level, r.score, r.leads.length, r.verified, r.confidence].join(","))];
    const u = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "investigate-first.csv"; a.click();
  };

  if (!loaded) return <Busy label="Loading the ranking…" />;
  if (!analysis) return <Empty icon={<Crosshair />} title="Run the novelty analysis first">The ranking is computed from the verified evidence of the novelty report.
    <div className="mt-4"><button className="btn-primary" onClick={() => go("novelty")}><Radar size={15} /> Open novelty report</button></div></Empty>;
  const top = rows[0];
  return (
    <div className="space-y-5">
      <div className="glass-card gradient-border relative flex flex-wrap items-start gap-4 overflow-hidden p-5"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="icon-tile"><Crosshair size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Investigate first</div>
          <div className="mt-0.5 text-[15px] font-semibold">“{top.contribution}” is the claim most likely to exist already</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600 dark:text-slate-300">
            <li>{rows.filter((r) => r.level === "high").length} of {rows.length} claims have strong verified overlap; {rows.filter((r) => r.level === "low").length} {rows.filter((r) => r.level === "low").length === 1 ? "shows" : "show"} little or no matching evidence in this collection.</li>
            <li>Largest: <b>C{top.index + 1}</b>, with {top.leads.length} supporting lead{top.leads.length === 1 ? "" : "s"} and {top.verified} verified quote{top.verified === 1 ? "" : "s"}.</li>
            <li>{analysis.insight!.coverage.explanation}</li>
          </ul>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col"><button className="btn-primary" onClick={() => go("novelty")}>Why? View evidence</button><button className="btn-outline" onClick={csv}><Download size={14} /> CSV</button></div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead><tr className="border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wider text-ink-mute dark:border-white/[.08]">
            {["#", "Claimed contribution", "Verified overlap", "Leads", "Quotes", "Confidence", "Supporting evidence (similarity)", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <>
              <tr key={r.index} onClick={() => setOpen(open === i ? null : i)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-white/[.05] dark:hover:bg-white/[.02]">
                <td className="px-4 py-3"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold dark:bg-white/[.07]">{i + 1}</span></td>
                <td className="max-w-[360px] px-4 py-3"><div className="font-medium leading-snug">{r.contribution}</div><div className="text-[11px] text-ink-mute">C{r.index + 1}</div></td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[.07]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(r.score / max) * 100}%` }} className={clsx("h-full rounded-full", LEVEL_BAR[r.level])} /></div>
                  <span className={clsx("text-[12px] font-semibold capitalize", LEVEL_TXT[r.level])}>{r.level}</span></div></td>
                <td className="px-4 py-3 font-mono">{r.leads.length}</td>
                <td className="px-4 py-3"><span className="flex items-center gap-1 font-mono"><BadgeCheck size={13} className="text-emerald-500" />{r.verified}</span></td>
                <td className="px-4 py-3"><Conf c={r.confidence} /></td>
                <td className="px-4 py-3"><div className="flex h-7 items-end gap-[3px]" style={{ height: 28 }}>{r.leads.slice(0, 12).map((l, j) => (
                  <span key={j} title={`${l.title} · ${l.relation.replace("_", " ")} · sim ${l.sim.toFixed(2)}`} className={clsx("w-2 rounded-sm", l.relation === "covers" ? "bg-rose-500/80" : "bg-amber-500/70", !l.verified && "opacity-40")}
                    style={{ height: `${30 + 70 * (l.sim / Math.max(0.01, ...r.leads.map((x) => x.sim)))}%` }} />))}{r.leads.length === 0 && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">no matching evidence</span>}</div></td>
                <td className="px-4 py-3"><ChevronDown size={15} className={clsx("transition", open === i && "rotate-180")} /></td>
              </tr>
              {open === i && <tr key={`d${r.index}`} className="border-b border-slate-100 bg-slate-50/60 dark:border-white/[.05] dark:bg-white/[.02]"><td /><td colSpan={7} className="px-4 py-4">
                {r.explanation && <p className="mb-3 text-[13px] text-slate-600 dark:text-slate-300"><span className="tag-ai mr-2">AI</span>{r.explanation}</p>}
                <div className="flex flex-wrap gap-1.5">{r.leads.map((l) => <span key={l.id} className="chip border border-slate-200 bg-white py-1 dark:border-white/10 dark:bg-white/[.05]">
                  <span className={clsx("h-1.5 w-1.5 rounded-full", l.relation === "covers" ? "bg-rose-500" : "bg-amber-500")} />{l.title.slice(0, 50)} <span className="text-ink-mute">· {l.type}</span></span>)}</div>
                <button className="btn-outline mt-3 !py-1 text-xs" onClick={() => go("novelty")}>Open in novelty report <ArrowRight size={13} /></button></td></tr>}
            </>))}</tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-ink-mute">Overlap is computed in code from verified matches only (covers = 1, partially covers = 0.5, weighted by retrieval score). Bars on the right show each supporting lead; faded bars have unverified quotes and don't count.</p>
    </div>
  );
}
