import { useEffect, useState } from "react";
import { api, type Analysis } from "../../lib/api";
import { ws, type Evidence } from "../../lib/ws";
import type { Project } from "../../lib/ws";

/** Loads everything a summary page needs: novelty analysis, evidence, discovery runs and the build plan. */
export function useProjectData(project: Project) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [research, setResearch] = useState<any>(null);
  const [github, setGithub] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      project.novelty_analysis ? api.analysis(project.novelty_analysis).catch(() => null) : Promise.resolve(null),
      ws.evidence(project.id, "").catch(() => []),
      ws.artifact(project.id, "research_run").catch(() => null),
      ws.artifact(project.id, "github_run").catch(() => null),
      ws.artifact(project.id, "build_plan").catch(() => null),
    ]).then(([a, e, r, g, p]) => {
      if (!alive) return;
      setAnalysis(a && a.status === "done" ? a : null); setEvidence(e as Evidence[]);
      setResearch(r && (r as any).queries ? r : null); setGithub(g && (g as any).queries ? g : null); setPlan(p && (p as any).workflow ? p : null); setLoaded(true);
    });
    return () => { alive = false; };
  }, [project.id, project.novelty_analysis, project.updated_at, project.counts.research, project.counts.github]);
  return { analysis, evidence, research, github, plan, loaded };
}

export const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
