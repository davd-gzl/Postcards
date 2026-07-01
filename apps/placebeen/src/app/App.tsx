import { lazy, Suspense, useEffect, useState } from "react";
import { useVisits } from "../lib/store/useVisits";
import { StatsView } from "../features/stats/StatsView";
import { VisitsList } from "../features/visits/VisitsList";
import { Backup } from "../features/backup/Backup";
import { Attribution } from "../ui/Attribution";
import { MapIcon, ChartIcon, ListIcon } from "../ui/icons";

// Code-split MapLibre so it loads only when the map is shown.
const MapScreen = lazy(() =>
  import("../features/map/MapScreen").then((m) => ({ default: m.MapScreen })),
);

type Tab = "map" | "stats" | "places";

const TABS: { id: Tab; label: string; keys: string[]; Icon: () => JSX.Element }[] = [
  { id: "map", label: "Map", keys: ["1", "m"], Icon: MapIcon },
  { id: "stats", label: "Stats", keys: ["2", "s"], Icon: ChartIcon },
  { id: "places", label: "Places", keys: ["3", "p"], Icon: ListIcon },
];

export function App() {
  const [tab, setTab] = useState<Tab>("map");

  useEffect(() => {
    void useVisits.getState().load();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const match = TABS.find((x) => x.keys.includes(e.key.toLowerCase()));
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
        <span className="brand">Place'Been</span>
      </header>

      <main id="main" className={"content" + (tab === "map" ? " flush" : "")}>
        {tab === "map" && (
          <Suspense fallback={<p className="muted empty">Loading map…</p>}>
            <MapScreen />
          </Suspense>
        )}
        {tab === "stats" && (
          <div className="screen">
            <StatsView />
          </div>
        )}
        {tab === "places" && (
          <div className="screen">
            <VisitsList />
            <Backup />
            <Attribution />
          </div>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={"nav-item" + (tab === id ? " active" : "")}
            aria-current={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
