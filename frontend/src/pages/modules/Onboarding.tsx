import clsx from "clsx";
import { motion } from "framer-motion";
import {
  AlertTriangle, BadgeCheck, Bot, Boxes, ChevronDown, ChevronRight, Compass, FileCode2, Folder, FolderOpen, GitBranch, KeyRound, ListTodo, Loader2, Package,
  Route, Search, Send, Sparkles, Terminal, TestTube2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Busy, CopyButton, ExtLink, Mermaid } from "../../components/kit";
import { Empty, ErrorBox, Verified } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { ws } from "../../lib/ws";
import { useProject } from "../Workspace";

interface Node { name: string; path: string; type: "dir" | "file"; children: Node[]; files?: number; size?: number }

function Tree({ node, depth, open, onFile, sel, filter }: { node: Node; depth: number; open: Set<string>; onFile: (p: string) => void; sel: string; filter: string; }) {
  const [o, setO] = useState(depth < 1 || open.has(node.path));
  useEffect(() => { if (open.has(node.path)) setO(true); }, [open, node.path]);
  const kids = node.children.filter((c) => !filter || c.path.toLowerCase().includes(filter) || c.type === "dir");
  if (node.type === "file") {
    if (filter && !node.path.toLowerCase().includes(filter)) return null;
    return <button onClick={() => onFile(node.path)} style={{ paddingLeft: depth * 12 + 8 }}
      className={clsx("flex w-full items-center gap-1.5 truncate rounded-md py-1 pr-2 text-left text-[12.5px]", sel === node.path ? "bg-brand-500/15 text-brand-700 dark:text-brand-200" : "hover:bg-slate-900/[.04] dark:hover:bg-white/[.05]")}>
      <FileCode2 size={13} className="shrink-0 text-ink-mute" />{node.name}</button>;
  }
  return (
    <div>
      {depth > 0 && <button onClick={() => setO(!o)} style={{ paddingLeft: depth * 12 - 4 }} className="flex w-full items-center gap-1 truncate rounded-md py-1 pr-2 text-left text-[12.5px] font-medium hover:bg-slate-900/[.04] dark:hover:bg-white/[.05]">
        {o ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{o ? <FolderOpen size={13} className="text-amber-500" /> : <Folder size={13} className="text-amber-500" />}{node.name}
        <span className="ml-auto text-[10px] text-ink-mute">{node.files}</span></button>}
      {(o || filter) && kids.map((c) => <Tree key={c.path} node={c} depth={depth + 1} open={open} onFile={onFile} sel={sel} filter={filter} />)}
    </div>
  );
}

const TABS = [
  { k: "overview", l: "Overview", i: Compass }, { k: "setup", l: "Setup guide", i: Terminal }, { k: "deps", l: "Dependencies", i: Package },
  { k: "env", l: "Environment", i: KeyRound }, { k: "routes", l: "Routes / APIs", i: Route }, { k: "tests", l: "Tests", i: TestTube2 },
  { k: "tasks", l: "Starter tasks", i: ListTodo }, { k: "file", l: "File viewer", i: FileCode2 },
] as const;

export default function OnboardingView() {
  const { project, reload } = useProject();
  const [params] = useSearchParams();
  const [url, setUrl] = useState(params.get("url") || "");
  const [scan, setScan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("overview");
  const [file, setFile] = useState<{ path: string; content: string; masked: boolean; hl?: [number, number] } | null>(null);
  const [filter, setFilter] = useState("");
  const [recent, setRecent] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    ws.scans().then(setRecent).catch(() => {});
    if (params.get("url")) return;
    ws.artifact<string>(project.id, "onboarding_scan").then((sid) => { if (typeof sid === "string" && sid) ws.getScan(sid).then(setScan); }).catch(() => {});
  }, [project.id]); // eslint-disable-line

  const doScan = async (u = url) => {
    setBusy(true); setError(null); setFile(null);
    try { const s = await ws.scan(u, project.id); setScan(s); setTab("overview"); reload(); } catch (e) { setError(e as ApiError); } finally { setBusy(false); }
  };
  const openFile = async (path: string, hl?: [number, number]) => {
    if (!scan) return;
    const f = await ws.file(scan.id, path); setFile({ ...f, hl }); setTab("file");
  };
  const ov = scan?.overview, sig = scan?.signals;

  return (
    <div className="space-y-5">
      <div className="glass-card p-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); doScan(); }}>
          <GitBranch size={17} className="ml-1 text-amber-500" />
          <input className="min-w-[260px] flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none" placeholder="https://github.com/owner/repository" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn-primary" disabled={busy || !url.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />} Inspect repository</button>
        </form>
        {recent.length > 0 && !scan && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-ink-mute">Recent:</span>
          {recent.slice(0, 5).map((r) => <button key={r.id} className="chip border border-slate-200 py-1 hover:border-amber-400 dark:border-white/10" onClick={() => ws.getScan(r.id).then(setScan)}>{r.id.replace("__", "/")}</button>)}</div>}
      </div>
      <ErrorBox error={error} />
      {busy ? <Busy label="Inspecting the repository…" steps={["Shallow-cloning (code is never executed)…", "Mapping the file tree…", "Reading manifests, configs and README…", "Detecting routes, tests and env vars…", "Writing the onboarding guide with Gemma 4…"]} />
        : !scan ? <Empty icon={<Compass />} title="Understand any public repository">Paste a GitHub URL, or open a repository from GitHub Intelligence. You'll get a file map, architecture, a setup guide drawn from the actual files, and a chat that answers with file and line references.</Empty> : (
          <>
            <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
              <img src={`https://github.com/${scan.owner}.png?size=64`} alt="" className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1"><div className="text-lg font-bold">{scan.owner}/<span className="gradient-text">{scan.repo}</span></div>
                <div className="flex flex-wrap gap-x-4 text-xs text-ink-mute"><span className="flex items-center gap-1"><GitBranch size={12} />{scan.ref}</span><span>{scan.file_count} files{scan.truncated ? " (truncated)" : ""}</span><span>{scan.chunks_indexed} chunks indexed</span><span>scanned {new Date(scan.scanned_at).toLocaleString()}</span></div></div>
              <ExtLink href={scan.url}>GitHub</ExtLink>
            </div>
            {scan.ai_error && <ErrorBox error={{ message: "AI overview unavailable", hint: scan.ai_error }} />}
            <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_380px]">
              {/* tree */}
              <aside className="glass-card flex max-h-[78vh] flex-col p-3 lg:sticky lg:top-20">
                <div className="relative mb-2"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input className="input !py-1.5 !pl-8 text-xs" placeholder="Filter files…" value={filter} onChange={(e) => setFilter(e.target.value.toLowerCase())} /></div>
                <div className="flex-1 overflow-y-auto scrollbar-thin"><Tree node={scan.tree} depth={0} open={new Set()} onFile={(p) => openFile(p)} sel={file?.path || ""} filter={filter} /></div>
              </aside>
              {/* main */}
              <section className="min-w-0 space-y-4">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">{TABS.map((t) => (
                  <button key={t.k} onClick={() => setTab(t.k)} className={clsx("relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold", tab === t.k ? "text-white" : "text-ink-mute hover:text-ink dark:hover:text-white")}>
                    {tab === t.k && <motion.span layoutId="otab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600" />}<span className="relative flex items-center gap-1.5"><t.i size={14} />{t.l}</span></button>))}</div>
                <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {tab === "overview" && <>
                    {ov && <div className="glass-card gradient-border p-5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300"><Sparkles size={13} /> AI overview from inspected files</div>
                      <p className="text-[15px] leading-relaxed">{ov.summary}</p>{ov.audience && <p className="mt-2 text-sm text-ink-mute">For: {ov.audience}</p>}</div>}
                    <div className="grid gap-4 lg:grid-cols-2">
                      {ov?.architecture?.mermaid && <div className="glass-card p-5 lg:col-span-2"><div className="section-title mb-3"><Boxes size={16} className="text-amber-500" /> Architecture · {ov.architecture.style}</div><Mermaid code={ov.architecture.mermaid} /></div>}
                      {ov?.architecture?.layers?.length > 0 && <div className="glass-card p-5"><div className="section-title mb-3">Layers</div><div className="space-y-2">{ov.architecture.layers.map((l: any) => (
                        <div key={l.name} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[.03]"><div className="font-semibold">{l.name} <span className="font-mono text-[11px] text-ink-mute">{(l.paths || []).join(" ")}</span></div><div className="text-ink-soft dark:text-slate-300">{l.explanation}</div></div>))}</div></div>}
                      <div className="glass-card p-5"><div className="section-title mb-3">Key folders</div><div className="space-y-1.5">{(ov?.folders || []).map((f: any) => (
                        <div key={f.path} className="flex gap-3 text-sm"><button className="w-32 shrink-0 truncate text-left font-mono text-[12px] text-brand-600 hover:underline dark:text-brand-300" onClick={() => setFilter(f.path.replace(/\/$/, "").toLowerCase())}>{f.path}</button><span className="text-ink-soft dark:text-slate-300">{f.purpose}</span></div>))}</div>
                        {ov?.architecture?.entry_points?.length > 0 && <><div className="label mt-4">Entry points</div>{ov.architecture.entry_points.map((e: any) => <button key={e.path} onClick={() => openFile(e.path)} className="mt-1 block text-left text-sm"><span className="font-mono text-[12px] text-brand-600 dark:text-brand-300">{e.path}</span>: {e.why}</button>)}</>}</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">{[["Languages", sig.languages.slice(0, 3).map((l: any) => l.ext).join(" ")], ["Manifests", sig.manifests.length], ["Tests", sig.tests.length], ["Routes", sig.routes.length]].map(([l, v]) => (
                      <div key={l as string} className="glass-card p-4"><div className="text-xl font-extrabold">{v || "–"}</div><div className="text-xs text-ink-mute">{l}</div></div>))}</div>
                  </>}
                  {tab === "setup" && <div className="space-y-4">
                    {ov?.setup?.prerequisites?.length > 0 && <div className="glass-card p-5"><div className="section-title mb-2">Prerequisites</div><div className="flex flex-wrap gap-2">{ov.setup.prerequisites.map((p: string) => <span key={p} className="chip bg-amber-500/10 py-1 text-amber-700 dark:text-amber-200">{p}</span>)}</div></div>}
                    {[["Install & configure", ov?.setup?.steps], ["Run it", ov?.setup?.run]].map(([title, steps]: any) => steps?.length > 0 && (
                      <div key={title} className="glass-card p-5"><div className="section-title mb-3"><Terminal size={16} className="text-amber-500" />{title}</div>
                        <ol className="space-y-3">{steps.map((s: any, i: number) => (
                          <li key={i} className="rounded-xl border border-slate-200/70 p-3 dark:border-white/[.07]"><div className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">{i + 1}</span>{s.title || s.what}</div>
                            {s.command && <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-emerald-300"><span className="text-slate-500">$</span><span className="flex-1 overflow-x-auto">{s.command}</span><CopyButton text={s.command} /></div>}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-mute">{s.source && <button className="font-mono hover:underline" onClick={() => openFile(s.source.split(":")[0])}>source: {s.source}</button>}
                              {s.command && <span className={clsx("chip", s.verified ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>{s.verified ? <><BadgeCheck size={11} /> found in source file</> : <><AlertTriangle size={11} /> inferred: check before running</>}</span>}{s.note}</div></li>))}</ol></div>))}
                    {ov?.setup?.windows_notes && <div className="glass-card p-4 text-sm"><b>Windows:</b> {ov.setup.windows_notes}</div>}
                    {ov?.gotchas?.length > 0 && <div className="glass-card p-4"><div className="section-title mb-2"><AlertTriangle size={15} className="text-amber-500" /> Gotchas</div><ul className="list-disc space-y-1 pl-5 text-sm">{ov.gotchas.map((g: string) => <li key={g}>{g}</li>)}</ul></div>}
                  </div>}
                  {tab === "deps" && <div className="space-y-4">
                    {ov?.key_dependencies?.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{ov.key_dependencies.map((d: any) => <div key={d.name} className="glass-card p-4"><div className="font-mono text-sm font-bold">{d.name}</div><div className="text-sm text-ink-soft dark:text-slate-300">{d.role}</div></div>)}</div>}
                    <div className="glass-card overflow-x-auto p-2"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-ink-mute"><th className="px-3 py-2">Package</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Manifest</th></tr></thead>
                      <tbody>{sig.dependencies.map((d: any, i: number) => <tr key={i} className="border-t border-slate-200/60 dark:border-white/[.06]"><td className="px-3 py-1.5 font-mono text-[12px]">{d.name}</td><td className="px-3 py-1.5 font-mono text-[11px] text-ink-mute">{d.version}</td><td className="px-3 py-1.5 text-xs">{d.dev ? "dev" : "runtime"}</td><td className="px-3 py-1.5 font-mono text-[11px]">{d.file}</td></tr>)}</tbody></table>
                      {sig.dependencies.length === 0 && <p className="p-4 text-sm text-ink-mute">No dependencies detected in manifests.</p>}</div></div>}
                  {tab === "env" && <div className="glass-card p-5"><div className="section-title mb-1"><KeyRound size={16} className="text-amber-500" /> Environment variables</div>
                    <p className="mb-3 text-xs text-ink-mute">Names and purposes only. Secret values are never read or shown, and anything that looks like a key is masked.</p>
                    {sig.env_vars.length === 0 ? <p className="text-sm text-ink-mute">No environment variables found.</p> : <div className="space-y-1.5">{sig.env_vars.map((e: any) => (
                      <div key={e.name} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[.03]"><span className="font-mono font-semibold">{e.name}</span><span className="text-xs text-ink-mute">{e.comment}</span><span className="ml-auto font-mono text-[11px] text-ink-mute">{e.file}</span></div>))}</div>}</div>}
                  {tab === "routes" && <div className="glass-card overflow-x-auto p-2">{sig.routes.length === 0 ? <p className="p-4 text-sm text-ink-mute">No HTTP routes detected (FastAPI, Flask, Express, Spring and Django patterns were checked).</p> :
                    <table className="w-full text-sm"><thead><tr className="text-left text-xs text-ink-mute"><th className="px-3 py-2">Method</th><th className="px-3 py-2">Path</th><th className="px-3 py-2">Framework</th><th className="px-3 py-2">Location</th></tr></thead>
                      <tbody>{sig.routes.map((r: any, i: number) => <tr key={i} className="border-t border-slate-200/60 dark:border-white/[.06]"><td className="px-3 py-1.5"><span className="rounded bg-brand-500/15 px-1.5 font-mono text-[11px] font-bold text-brand-700 dark:text-brand-200">{r.method}</span></td>
                        <td className="px-3 py-1.5 font-mono text-[12px]">{r.path}</td><td className="px-3 py-1.5 text-xs">{r.framework}</td><td className="px-3 py-1.5"><button className="font-mono text-[11px] text-brand-600 hover:underline dark:text-brand-300" onClick={() => openFile(r.file, [r.line, r.line])}>{r.file}:{r.line}</button></td></tr>)}</tbody></table>}</div>}
                  {tab === "tests" && <div className="space-y-4"><div className="glass-card p-5 text-sm"><div className="section-title mb-2"><TestTube2 size={16} className="text-emerald-500" /> How to run tests</div>
                    {ov?.tests?.how_to_run && <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-emerald-300"><span className="text-slate-500">$</span><span className="flex-1">{ov.tests.how_to_run}</span><CopyButton text={ov.tests.how_to_run} /></div>}
                    <p className="mt-2 text-xs text-ink-mute">{ov?.tests?.source && `Source: ${ov.tests.source}. `}{ov?.tests?.notes}</p></div>
                    <div className="glass-card p-4"><div className="label mb-2">{sig.tests.length} test files</div><div className="grid gap-1 sm:grid-cols-2">{sig.tests.map((t: string) => <button key={t} onClick={() => openFile(t)} className="truncate text-left font-mono text-[12px] text-brand-600 hover:underline dark:text-brand-300">{t}</button>)}</div>
                      {sig.ci.length > 0 && <p className="mt-3 text-xs text-ink-mute">CI workflows: {sig.ci.join(", ")}</p>}</div></div>}
                  {tab === "tasks" && <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">{(ov?.starter_tasks || []).map((t: any, i: number) => (
                      <div key={i} className="glass-card glass-hover p-5"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{t.title}</span><span className="chip bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{t.difficulty}</span></div>
                        <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{t.why}</p><div className="mt-2 flex flex-wrap gap-1">{(t.files || []).map((f: string) => <button key={f} onClick={() => openFile(f)} className="font-mono text-[11px] text-brand-600 hover:underline dark:text-brand-300">{f}</button>)}</div></div>))}</div>
                    {sig.docs_gaps.length > 0 && <div className="glass-card p-4"><div className="label mb-2">Documentation gaps (easy first contributions)</div><ul className="list-disc space-y-1 pl-5 text-sm">{sig.docs_gaps.map((g: string) => <li key={g}>{g}</li>)}</ul></div>}
                    {sig.todos.length > 0 && <div className="glass-card p-4"><div className="label mb-2">TODO / FIXME comments</div><div className="space-y-1">{sig.todos.slice(0, 20).map((t: any, i: number) => (
                      <button key={i} onClick={() => openFile(t.file, [t.line, t.line])} className="block w-full truncate text-left font-mono text-[11.5px] hover:text-brand-600"><span className="text-ink-mute">{t.file}:{t.line}</span> {t.text}</button>))}</div></div>}
                  </div>}
                  {tab === "file" && (file ? <FileViewer file={file} /> : <Empty icon={<FileCode2 />} title="Pick a file">Click any file in the tree, or a file reference in chat.</Empty>)}
                </motion.div>
              </section>
              {/* chat */}
              <AskRepo sid={scan.id} onRef={(p, a, b) => openFile(p, [a, b])} />
            </div>
          </>)}
    </div>
  );
}

function FileViewer({ file }: { file: { path: string; content: string; masked: boolean; hl?: [number, number] } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (file.hl) ref.current?.querySelector(`[data-l="${file.hl[0]}"]`)?.scrollIntoView({ block: "center" }); }, [file]);
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2 font-mono text-xs dark:border-white/[.07]"><span>{file.path}</span>{file.masked && <span className="chip bg-amber-500/15 text-amber-600">secrets masked</span>}</div>
      <div ref={ref} className="max-h-[66vh] overflow-auto bg-slate-950 py-2 font-mono text-[12px] leading-[1.55] text-slate-200 scrollbar-thin">
        {lines.map((l, i) => { const n = i + 1; const on = file.hl && n >= file.hl[0] && n <= file.hl[1];
          return <div key={i} data-l={n} className={clsx("flex", on && "bg-amber-400/20")}><span className="w-12 shrink-0 select-none pr-3 text-right text-slate-600">{n}</span><pre className="whitespace-pre pr-4">{l || " "}</pre></div>; })}
      </div>
    </div>
  );
}

const SUGGEST = ["Where is the main entry point?", "How do I run this project on Windows?", "Where should I add a new API endpoint?", "Which database is used and where is it configured?", "What is one beginner-friendly improvement I can make?"];

function AskRepo({ sid, onRef }: { sid: string; onRef: (p: string, a: number, b: number) => void }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: question }]); setQ(""); setBusy(true);
    try { const r = await ws.askRepo(sid, question); setMsgs((m) => [...m, { role: "ai", ...r }]); }
    catch (e) { setMsgs((m) => [...m, { role: "ai", answer: (e as ApiError).message, references: [], error: true }]); } finally { setBusy(false); }
  };
  return (
    <aside className="glass-card flex h-[70vh] flex-col lg:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-20 2xl:h-[78vh]">
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-white/[.07]"><div className="icon-tile h-8 w-8 bg-gradient-to-br from-amber-500 to-orange-600"><Bot size={15} /></div>
        <div><div className="text-sm font-bold">Ask your repository</div><div className="text-[11px] text-ink-mute">Answers cite files and lines</div></div></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {msgs.length === 0 && <div className="space-y-2">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="block w-full rounded-xl border border-slate-200/80 p-2.5 text-left text-[13px] hover:border-amber-400 hover:bg-amber-500/5 dark:border-white/10">{s}</button>)}</div>}
        {msgs.map((m, i) => m.role === "user" ? <div key={i} className="ml-8 rounded-2xl rounded-br-sm bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-2.5 text-sm text-white">{m.text}</div> : (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mr-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-3 text-sm dark:bg-white/[.06]">
            <p className="whitespace-pre-wrap leading-relaxed">{m.answer}</p>
            {m.references?.map((r: any, j: number) => { const [a, b] = String(r.lines || "1").split("-").map((x: string) => parseInt(x) || 1);
              return <button key={j} onClick={() => onRef(r.path, a, b || a)} className="mt-2 block w-full rounded-lg bg-white p-2 text-left text-xs dark:bg-white/5">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-mono font-semibold text-brand-600 dark:text-brand-300">{r.path}:{r.lines}</span>{r.excerpt && <Verified ok={!!r.verified} />}</div>
                {r.excerpt && <pre className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11px] text-ink-soft dark:text-slate-400">{r.excerpt}</pre>}</button>; })}
            {m.next_step && <p className="mt-2 text-xs"><b>Next step:</b> {m.next_step}</p>}
            {m.confidence && <div className="mt-1 text-[10px] uppercase tracking-wide text-ink-mute">confidence: {m.confidence}</div>}
          </motion.div>))}
        {busy && <div className="flex items-center gap-2 text-sm text-ink-mute"><Loader2 size={14} className="animate-spin" /> Searching the code…</div>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-slate-200/70 p-3 dark:border-white/[.07]" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="input !py-2" placeholder="Where is login implemented?" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary !px-3" disabled={busy || !q.trim()} aria-label="Ask"><Send size={15} /></button>
      </form>
    </aside>
  );
}
