import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, Boxes, ClipboardCheck, Cloud, Database, Download, Flag, KeyRound, Layers, ListChecks, Loader2, Network, RefreshCw, Rocket, ShieldCheck, Target, Users, Waypoints, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Busy, CopyButton, Label, Mermaid } from "../../components/kit";
import { ErrorBox } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws } from "../../lib/ws";
import { useProject } from "../Workspace";

const TABS = [
  { k: "problem", l: "Problem & solution", i: Target }, { k: "architecture", l: "Architecture", i: Network }, { k: "stack", l: "Tech stack", i: Layers },
  { k: "database", l: "Database", i: Database }, { k: "apis", l: "APIs", i: Waypoints }, { k: "roadmap", l: "Roadmap", i: Flag },
  { k: "testing", l: "Testing & deploy", i: ClipboardCheck }, { k: "additional_features", l: "Extra features & risks", i: Rocket },
] as const;
const PRESETS = [
  { l: "Hackathon (1 day)", v: "student/hackathon team of 3-4, one day to build an MVP, free-tier hosting, Python and JavaScript skills" },
  { l: "Semester project", v: "college team of 4, 3 months, free or student credits, intermediate web and ML skills, must be demo-able to faculty" },
  { l: "Startup MVP", v: "2 founders + 1 engineer, 6 weeks, small cloud budget, needs authentication, analytics and room to scale" },
];
const METHOD: Record<string, string> = { GET: "bg-emerald-500", POST: "bg-sky-500", PUT: "bg-amber-500", PATCH: "bg-violet-500", DELETE: "bg-rose-500" };

function toMarkdown(a: any, title: string) {
  const L: string[] = [`# ${title}: technical blueprint`, "", `Constraints: ${a.constraints}`, "", "## Problem", a.problem?.statement, "", `Objective: ${a.problem?.objective}`, "",
    "## Solution", a.solution?.concept, "", "## Tech stack", ...(a.stack || []).map((s: any) => `- **${s.layer}:** ${s.choice}. ${s.why} (alternatives: ${(s.alternatives || []).join(", ")})`),
    "", "## Architecture", "```mermaid", a.architecture?.mermaid?.replace(/\\n/g, "\n") || "", "```", ...(a.architecture?.components || []).map((c: any) => `- **${c.name}:** ${c.responsibility}`),
    "", "## Database", "```mermaid", a.database?.mermaid?.replace(/\\n/g, "\n") || "", "```", "", "## API", "| Method | Path | Purpose | Auth |", "|---|---|---|---|",
    ...(a.apis || []).map((x: any) => `| ${x.method} | ${x.path} | ${x.purpose} | ${x.auth} |`), "", "## Roadmap",
    ...(a.roadmap || []).flatMap((p: any) => [`### ${p.phase}`, p.goal, ...(p.tasks || []).map((t: any) => `- [ ] (${t.priority}) ${t.title}: done when ${t.done_when}`)]),
    "", "## Testing", ...(a.testing || []).map((t: any) => `- **${t.type}:** ${t.what}`), "", "## Deployment", `Hosting: ${a.deployment?.hosting}`,
    ...(a.deployment?.steps || []).map((s: string) => `1. ${s}`), "", "## Additional features", ...(a.additional_features || []).map((f: any) => `- **${f.title}** (${f.effort}): ${f.why}`)];
  return L.join("\n");
}

export default function ArchitectView() {
  const { project, reload } = useProject();
  const [a, setA] = useState<any>(null);
  const [cons, setCons] = useState(PRESETS[0].v);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("problem");
  const [instr, setInstr] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => { ws.artifact(project.id, "architect").then((x) => { if (x?.stack) { setA(x); setCons(x.constraints || cons); } }).catch(() => {}); }, [project.id]); // eslint-disable-line

  const gen = async () => { setBusy("all"); setError(null); try { setA(await ws.architect(project.id, cons)); reload(); } catch (e) { setError(e as ApiError); } finally { setBusy(""); } };
  const regen = async () => {
    const section = tab === "testing" ? "testing" : tab;
    setBusy(section); setError(null);
    try { setA(await ws.architect(project.id, cons, section, instr)); setInstr(""); } catch (e) { setError(e as ApiError); } finally { setBusy(""); }
  };
  const download = () => {
    const blob = new Blob([toMarkdown(a, project.title)], { type: "text/markdown" });
    const u = URL.createObjectURL(blob); const el = document.createElement("a"); el.href = u; el.download = "blueprint.md"; el.click(); URL.revokeObjectURL(u);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center gap-2"><span className="label mr-1">Team & constraints</span>
          {PRESETS.map((p) => <button key={p.l} onClick={() => setCons(p.v)} className={clsx("chip py-1 ring-1", cons === p.v ? "bg-emerald-500 text-white ring-emerald-500" : "ring-slate-200 dark:ring-white/10")}>{p.l}</button>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input min-w-[260px] flex-1" value={cons} onChange={(e) => setCons(e.target.value)} placeholder="Team size, skills, timeline, budget, hosting limits, data sensitivity…" />
          <button className="btn-primary" onClick={gen} disabled={!!busy}>{busy === "all" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {a ? "Regenerate blueprint" : "Generate blueprint"}</button>
          {a && <button className="btn-outline" onClick={download}><Download size={15} /> Markdown</button>}
        </div>
        <p className="mt-2 text-xs text-ink-mute">The stack adapts to these constraints and to the papers and repositories in your evidence library. It's never a one-size-fits-all template.</p>
      </div>
      <ErrorBox error={error} />
      {busy === "all" ? <Busy label="Architecting your project with Gemma 4…" steps={["Defining the problem and users…", "Choosing a stack for your constraints…", "Designing components and data flow…", "Drafting the database and APIs…", "Planning the roadmap and tests…"]} /> : !a ? (
        <div className="glass-card flex flex-col items-center gap-3 px-6 py-16 text-center"><div className="icon-tile h-14 w-14 bg-gradient-to-br from-emerald-500 to-teal-500"><Waypoints size={26} /></div>
          <div className="text-lg font-bold">Turn the idea into a buildable blueprint</div>
          <p className="max-w-md text-sm text-ink-mute">Problem definition, architecture diagram, reasoned tech stack, database schema, API catalogue, phased roadmap, tests, deployment checklist and standout features.</p></div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={clsx("relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold", tab === t.k ? "text-white" : "text-ink-mute hover:text-ink dark:hover:text-white")}>
                {tab === t.k && <motion.span layoutId="atab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-glow" />}
                <span className="relative flex items-center gap-2"><t.i size={15} />{t.l}</span></button>))}
          </div>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {busy && busy !== "all" ? <Busy label="Revising this section…" /> : <Section tab={tab} a={a} />}
          </motion.div>
          <div className="glass-card flex flex-wrap items-center gap-2 p-3">
            <RefreshCw size={15} className="ml-1 text-ink-mute" />
            <input className="min-w-[240px] flex-1 bg-transparent px-2 text-sm focus:outline-none" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={`Revise "${TABS.find((t) => t.k === tab)?.l}"… e.g. "use Supabase instead of Firebase"`} />
            <button className="btn-outline !py-1.5 text-xs" onClick={regen} disabled={!!busy}>Regenerate this section</button>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={clsx("glass-card p-5", className)}><div className="section-title mb-3">{icon}{title}</div>{children}</div>;
}

function Section({ tab, a }: { tab: string; a: any }) {
  if (tab === "problem") return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Problem" icon={<Target size={16} className="text-rose-500" />}>
        <p className="text-sm leading-relaxed">{a.problem?.statement}</p>
        <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm"><b>Objective:</b> {a.problem?.objective}</div>
        <div className="mt-3 label">Pain points</div><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{a.problem?.pain_points?.map((p: string) => <li key={p}>{p}</li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-1.5"><Users size={14} className="text-ink-mute" />{a.problem?.users?.map((u: string) => <span key={u} className="chip bg-slate-100 dark:bg-white/[.06]">{u}</span>)}</div>
      </Card>
      <Card title="Solution" icon={<Rocket size={16} className="text-violet-500" />}>
        <p className="text-sm leading-relaxed">{a.solution?.concept}</p>
        <div className="mt-3 label">Roles</div><div className="mt-1 flex flex-wrap gap-1.5">{a.solution?.roles?.map((r: string) => <span key={r} className="chip bg-violet-500/10 text-violet-700 dark:text-violet-200">{r}</span>)}</div>
        <div className="mt-3 label">User flow</div>
        <ol className="mt-2 space-y-2">{a.solution?.user_flow?.map((s: string, i: number) => <li key={i} className="flex gap-2 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">{i + 1}</span>{s}</li>)}</ol>
      </Card>
    </div>);
  if (tab === "architecture") return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card title="System diagram" icon={<Network size={16} className="text-cyan-500" />}><Mermaid code={a.architecture?.mermaid || ""} />
        <div className="mt-3 flex justify-end"><CopyButton text={(a.architecture?.mermaid || "").replace(/\\n/g, "\n")} label="Copy Mermaid" /></div></Card>
      <div className="space-y-5">
        <Card title="Components" icon={<Boxes size={16} className="text-emerald-500" />}>
          <div className="space-y-2">{a.architecture?.components?.map((c: any) => (
            <div key={c.name} className="rounded-xl border border-slate-200/70 p-3 text-sm dark:border-white/[.07]"><div className="flex items-center gap-2 font-semibold">{c.name}{c.trust_boundary && <span className="chip bg-amber-500/15 text-amber-600 dark:text-amber-300"><ShieldCheck size={11} /> trust boundary</span>}</div>
              <div className="text-ink-soft dark:text-slate-300">{c.responsibility}</div></div>))}</div></Card>
        <Card title="Data flow" icon={<Waypoints size={16} className="text-brand-500" />}><ul className="space-y-1.5 font-mono text-[12px]">{a.architecture?.data_flow?.map((d: string) => <li key={d}>→ {d}</li>)}</ul></Card>
      </div>
    </div>);
  if (tab === "stack") return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{a.stack?.map((s: any, i: number) => (
      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card glass-hover p-5">
        <div className="label">{s.layer}</div><div className="mt-1 text-lg font-bold">{s.choice}</div>
        <p className="mt-2 text-sm text-ink-soft dark:text-slate-300">{s.why}</p>
        {s.alternatives?.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-ink-mute">Alternatives:</span>{s.alternatives.map((x: string) => <span key={x} className="chip bg-slate-100 dark:bg-white/[.06]">{x}</span>)}</div>}
      </motion.div>))}</div>);
  if (tab === "database") return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <Card title="Entity-relationship diagram" icon={<Database size={16} className="text-sky-500" />}><Mermaid code={a.database?.mermaid || ""} /></Card>
      <div className="space-y-3">{a.database?.entities?.map((e: any) => (
        <div key={e.name} className="glass-card p-4"><div className="font-mono text-sm font-bold text-sky-600 dark:text-sky-300">{e.name}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{e.fields?.map((f: string) => <span key={f} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] dark:bg-white/[.06]">{f}</span>)}</div>
          {e.relations?.length > 0 && <div className="mt-2 text-xs text-ink-mute">{e.relations.join(" · ")}</div>}</div>))}</div>
    </div>);
  if (tab === "apis") return (
    <div className="glass-card overflow-x-auto p-2"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-xs text-ink-mute">{["Method", "Endpoint", "Purpose", "Auth", "Request → Response"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{a.apis?.map((x: any, i: number) => (
        <tr key={i} className="border-t border-slate-200/60 align-top dark:border-white/[.06]"><td className="px-3 py-3"><span className={clsx("rounded-md px-2 py-0.5 font-mono text-[11px] font-bold text-white", METHOD[x.method] || "bg-slate-500")}>{x.method}</span></td>
          <td className="px-3 py-3 font-mono text-[12px]">{x.path}</td><td className="px-3 py-3">{x.purpose}</td>
          <td className="px-3 py-3"><span className="chip bg-slate-100 dark:bg-white/[.06]"><KeyRound size={11} />{x.auth}</span></td><td className="px-3 py-3 text-xs text-ink-mute">{x.request} → {x.response}</td></tr>))}</tbody></table></div>);
  if (tab === "roadmap") return (
    <div className="grid gap-4 lg:grid-cols-3">{a.roadmap?.map((p: any, i: number) => (
      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="glass-card p-5">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">{i + 1}</span><div className="font-bold">{p.phase}</div></div>
        <p className="mt-2 text-sm text-ink-mute">{p.goal}</p>
        <ul className="mt-3 space-y-2">{p.tasks?.map((t: any, j: number) => (
          <li key={j} className="rounded-xl border border-slate-200/70 p-3 text-sm dark:border-white/[.07]"><div className="flex items-start justify-between gap-2"><span className="font-medium">{t.title}</span>
            <span className={clsx("chip shrink-0 text-white", t.priority === "P0" ? "bg-rose-500" : t.priority === "P1" ? "bg-amber-500" : "bg-slate-500")}>{t.priority}</span></div>
            {t.depends_on && t.depends_on !== "none" && <div className="mt-1 text-[11px] text-ink-mute">Depends on: {t.depends_on}</div>}
            <div className="mt-1 flex items-start gap-1 text-[11px] text-emerald-700 dark:text-emerald-300"><ListChecks size={11} className="mt-0.5" />{t.done_when}</div></li>))}</ul>
      </motion.div>))}</div>);
  if (tab === "testing") return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Testing plan" icon={<ClipboardCheck size={16} className="text-brand-500" />}><div className="space-y-2">{a.testing?.map((t: any, i: number) => (
        <div key={i} className="flex gap-3 text-sm"><span className="chip h-fit shrink-0 bg-brand-500/15 capitalize text-brand-700 dark:text-brand-200">{t.type}</span>{t.what}</div>))}</div></Card>
      <Card title="Deployment" icon={<Cloud size={16} className="text-sky-500" />}>
        <div className="text-sm"><b>Hosting:</b> {a.deployment?.hosting}</div>
        <div className="mt-3 label">Environment variables</div><div className="mt-1 space-y-1">{a.deployment?.env_vars?.map((v: string) => <div key={v} className="font-mono text-[12px]">{v}</div>)}</div>
        <div className="mt-3 label">Release checklist</div><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{a.deployment?.steps?.map((s: string) => <li key={s}>{s}</li>)}</ol>
        <div className="mt-3 text-sm"><b>Monitoring:</b> {a.deployment?.monitoring}</div>
      </Card>
    </div>);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{a.additional_features?.map((f: any, i: number) => (
        <div key={i} className="glass-card glass-hover p-5"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{f.title}</span><Label tone="rec">{f.effort}</Label></div>
          <p className="mt-1.5 text-sm text-ink-soft dark:text-slate-300">{f.why}</p></div>))}</div>
      <Card title="Risks & mitigations" icon={<AlertTriangle size={16} className="text-amber-500" />}><div className="space-y-2">{a.risks?.map((r: any, i: number) => (
        <div key={i} className="grid gap-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[.03] sm:grid-cols-2"><span><b>Risk:</b> {r.risk ?? r}</span>{r.mitigation && <span className="text-emerald-700 dark:text-emerald-300"><b>Mitigation:</b> {r.mitigation}</span>}</div>))}</div></Card>
    </div>);
}
