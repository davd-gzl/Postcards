import { lazy, Suspense, useEffect, useRef, type JSX } from "react";
import { useVisits } from "../lib/store/useVisits";
import { useTrips } from "../lib/store/useTrips";
import { useStories } from "../lib/store/useStories";
import { useUi, type Tab } from "../lib/store/useUi";
import { StatsView } from "../features/stats/StatsView";
import { PlacesScreen } from "../features/visits/PlacesScreen";
import { TravelScreen } from "../features/travel/TravelScreen";
import { PassportScreen } from "../features/passport/PassportScreen";
import { JournalScreen } from "../features/journal/JournalScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { CityScreen } from "../features/city/CityScreen";
import { CountryScreen } from "../features/country/CountryScreen";
import { PlaceSearch } from "../features/visits/PlaceSearch";
import { ShortcutsHelp } from "../ui/ShortcutsHelp";
import { AboutModal } from "../ui/AboutModal";
import { Toast } from "../ui/Toast";
import { MapIcon, ChartIcon, ListIcon, RouteIcon, FlagIcon, BookIcon, GearIcon, InfoIcon } from "../ui/icons";
import { useState } from "react";
import { useInstallPrompt } from "../lib/hooks/useInstallPrompt";

// Code-split MapLibre so it loads only when the map is shown.
const MapScreen = lazy(() =>
  import("../features/map/MapScreen").then((m) => ({ default: m.MapScreen })),
);

const TABS: { id: Tab; label: string; keys: string[]; Icon: () => JSX.Element }[] = [
  { id: "map", label: "Map", keys: ["1", "m"], Icon: MapIcon },
  { id: "stats", label: "Stats", keys: ["2", "s"], Icon: ChartIcon },
  { id: "places", label: "Places", keys: ["3", "p"], Icon: ListIcon },
  { id: "trips", label: "Trips", keys: ["4", "t"], Icon: RouteIcon },
  { id: "passport", label: "Passport", keys: ["5", "f"], Icon: FlagIcon },
  { id: "journal", label: "Journal", keys: ["6", "j"], Icon: BookIcon },
];

export function App() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const cityPageId = useUi((s) => s.cityPageId);
  const countryPageId = useUi((s) => s.countryPageId);
  const [showHelp, setShowHelp] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const [showAbout, setShowAbout] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    void useVisits.getState().load();
    void useTrips.getState().load();
    void useStories.getState().load();
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
        // A modal/lightbox/open composer on screen consumes Escape (its own
        // handler closes it) — only an unobstructed Escape navigates back.
        const dialogOpen = !!document.querySelector(
          ".modal-backdrop, .lightbox, .maplibregl-popup, .journal-composer",
        );
        setShowHelp(false);
        setShowAbout(false);
        if (!dialogOpen) useUi.getState().goBack(); // Escape = previous screen
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;

      if (e.key === "/") {
        useUi.getState().setTab("map");
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
        useUi.getState().setTab(match.id);
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
            <h1 className="brand">Postcards</h1>
            {/* Global search in the bar itself — no screen spends a row on it.
                Picking a city flies the map there (flyTo also switches the tab). */}
            <div className="topbar-search">
              <PlaceSearch
                onFocusCity={(c) => useUi.getState().flyTo(c.lon, c.lat)}
              />
            </div>
            <span className="topbar-actions">
              {canInstall && (
                <button
                  type="button"
                  className="topbar-about topbar-install"
                  onClick={() => void install()}
                >
                  ⬇ <span>Install app</span>
                </button>
              )}
              <button
                type="button"
                className="topbar-about"
                aria-haspopup="dialog"
                onClick={() => setShowAbout(true)}
              >
                <InfoIcon />
                <span>How it works</span>
              </button>
              <button
                type="button"
                className={"topbar-about topbar-gear" + (tab === "settings" ? " on" : "")}
                aria-label="Settings"
                title="Settings"
                onClick={() => setTab("settings")}
              >
                <GearIcon />
              </button>
            </span>
          </header>

      <p className="sr-only" role="status" aria-live="polite">
        {currentLabel} section
      </p>

      <nav className="bottom-nav" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={"nav-item" + (tab === id ? " active" : "")}
            aria-current={tab === id ? "page" : undefined}
            aria-label={label}
            title={label}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span aria-hidden>{label}</span>
          </button>
        ))}
      </nav>

      <main
            ref={mainRef}
            id="main"
            tabIndex={-1}
            className={"content" + (tab === "map" && !cityPageId && !countryPageId ? " flush" : "")}
          >
            {cityPageId ? (
              <CityScreen cityId={cityPageId} onBack={() => useUi.getState().closeCity()} />
            ) : countryPageId ? (
              <CountryScreen iso2={countryPageId} onBack={() => useUi.getState().closeCity()} />
            ) : (
              <>
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
                    <PlacesScreen />
                  </div>
                )}
                {tab === "trips" && (
                  <div className="screen">
                    <TravelScreen />
                  </div>
                )}
                {tab === "passport" && (
                  <div className="screen">
                    <PassportScreen />
                  </div>
                )}
                {tab === "journal" && (
                  <div className="screen">
                    <JournalScreen />
                  </div>
                )}
                {tab === "settings" && (
                  <div className="screen">
                    <SettingsScreen />
                  </div>
                )}
              </>
            )}
      </main>

      <Toast />

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
