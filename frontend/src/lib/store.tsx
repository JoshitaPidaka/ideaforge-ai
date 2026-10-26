import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Brief, type Health } from "./api";

interface Draft { proposalId: string; name: string; preview: string; figures: string[]; brief: Brief | null }
interface Ctx {
  health: Health | null; refreshHealth: () => void;
  collection: string; setCollection: (c: string) => void;
  simple: boolean; setSimple: (v: boolean) => void;
  dark: boolean; setDark: (v: boolean) => void;
  draft: Draft | null; setDraft: (d: Draft | null) => void;
}
const C = createContext<Ctx>(null as any);

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
}
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [collection, setCollectionS] = useState<string>(() => load("collection", "seed"));
  const [simple, setSimpleS] = useState<boolean>(() => load("simple", false));
  const [dark, setDarkS] = useState<boolean>(() => document.documentElement.classList.contains("dark"));
  const [draft, setDraftS] = useState<Draft | null>(() => load("draft", null));

  const refreshHealth = () => api.health().then(setHealth).catch(() => setHealth(null));
  useEffect(() => { refreshHealth(); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  return (
    <C.Provider value={{
      health, refreshHealth, collection, simple, dark, draft,
      setCollection: (c) => { setCollectionS(c); save("collection", c); },
      setSimple: (v) => { setSimpleS(v); save("simple", v); },
      setDark: setDarkS,
      setDraft: (d) => { setDraftS(d); save("draft", d); },
    }}>{children}</C.Provider>
  );
}
export const useApp = () => useContext(C);
