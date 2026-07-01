import { lazy, Suspense, useEffect, useState } from "react";
import { useVisits } from "../lib/store/useVisits";
import { AddVisit } from "../features/visits/AddVisit";
import { VisitsList } from "../features/visits/VisitsList";
import { StatsView } from "../features/stats/StatsView";
import { Backup } from "../features/backup/Backup";
import { Attribution } from "../ui/Attribution";

// Code-split MapLibre (the largest dependency) so it loads only when the map is shown.
const MapView = lazy(() =>
  import("../features/map/MapView").then((m) => ({ default: m.MapView })),
);

type Tab = "map" | "add" | "visits" | "stats" | "backup";

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: "map", label: "Map", key: "m" },
  { id: "add", label: "Add", key: "a" },
  { id: "visits", label: "Visits", key: "v" },
  { id: "stats", label: "Stats", key: "s" },
  { id: "backup", label: "Backup", key: "b" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("map");
  const loaded = useVisits((s) => s.loaded);

  useEffect(() => {
    void useVisits.getState().load();
  }, []);

  // Keyboard shortcuts for power users (Constitution VII).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const match = TABS.find((x) => x.key === e.key.toLowerCase());
      if (match) {
        setTab(match.id);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <h1>Place'Been</h1>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={tab === x.id}
              onClick={() => setTab(x.id)}
              title={`${x.label} (${x.key.toUpperCase()})`}
            >
              {x.label}
            </button>
          ))}
        </nav>
      </header>

      <main id="main" className={"content" + (tab === "map" ? " map-mode" : "")}>
        {!loaded && tab !== "map" && <p className="muted">Loading…</p>}
        {tab === "map" && (
          <Suspense fallback={<p className="muted" style={{ padding: 16 }}>Loading map…</p>}>
            <MapView />
          </Suspense>
        )}
        {tab === "add" && <AddVisit onAdded={() => undefined} />}
        {tab === "visits" && <VisitsList />}
        {tab === "stats" && <StatsView />}
        {tab === "backup" && (
          <div className="panel">
            <Backup />
            <Attribution />
          </div>
        )}
      </main>
    </div>
  );
}
