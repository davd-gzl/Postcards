import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useVisits } from "../lib/store/useVisits";
import { useUi } from "../lib/store/useUi";
import { StatsView } from "../features/stats/StatsView";
import { VisitsList } from "../features/visits/VisitsList";
import { Backup } from "../features/backup/Backup";
import { Attribution } from "../ui/Attribution";
import { ShortcutsHelp } from "../ui/ShortcutsHelp";
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
  const [showHelp, setShowHelp] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    void useVisits.getState().load();
  }, []);

  // Move focus to the content region on tab change (skip initial mount).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;

      if (e.key === "/") {
        setTab("map");
        useUi.getState().focusSearch();
        e.preventDefault();
        return;
      }
      if (e.key === "?") {
        setShowHelp(true);
        e.preventDefault();
        return;
      }
      const match = TABS.find((x) => x.keys.includes(e.key.toLowerCase()));
      if (match) {
        setTab(match.id);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentLabel = TABS.find((x) => x.id === tab)?.label ?? "";

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <span className="brand">Place'Been</span>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {currentLabel} section
      </p>

      <main ref={mainRef} id="main" tabIndex={-1} className={"content" + (tab === "map" ? " flush" : "")}>
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
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
