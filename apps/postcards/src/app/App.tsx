import { lazy, Suspense, useEffect, useRef, type JSX } from "react";
import { useVisits } from "../lib/store/useVisits";
import { useTrips } from "../lib/store/useTrips";
import { useStories } from "../lib/store/useStories";
import { useUi, type Tab } from "../lib/store/useUi";
import { StatsView } from "../features/stats/StatsView";
import { PlacesScreen } from "../features/visits/PlacesScreen";
import { TravelScreen } from "../features/travel/TravelScreen";
import { JournalScreen } from "../features/journal/JournalScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { CityScreen } from "../features/city/CityScreen";
import { CountryScreen } from "../features/country/CountryScreen";
import { PlaceSearch } from "../features/visits/PlaceSearch";
import { ShortcutsHelp } from "../ui/ShortcutsHelp";
import { AboutModal } from "../ui/AboutModal";
import { Toast } from "../ui/Toast";
import { MapIcon, ChartIcon, ListIcon, RouteIcon, BookIcon, GearIcon, InfoIcon } from "../ui/icons";
import { useState } from "react";
import { useInstallPrompt } from "../lib/hooks/useInstallPrompt";

// Code-split MapLibre so it loads only when the map is shown.
const MapScreen = lazy(() =>
  import("../features/map/MapScreen").then((m) => ({ default: m.MapScreen })),
);

// Five sections, all visible — no overflow menu. Passport and Moments are views
// inside Places now (they're collections of places, not destinations of their own).
const TABS: { id: Tab; label: string; keys: string[]; Icon: () => JSX.Element }[] = [
  { id: "map", label: "Map", keys: ["1", "m"], Icon: MapIcon },
  { id: "places", label: "Places", keys: ["2", "p"], Icon: ListIcon },
  { id: "trips", label: "Trips", keys: ["3", "t"], Icon: RouteIcon },
  { id: "journal", label: "Journal", keys: ["4", "j"], Icon: BookIcon },
  { id: "stats", label: "Stats", keys: ["5", "s"], Icon: ChartIcon },
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
  // Once the map has rendered it never unmounts again (see <main> below);
  // the tab already re-renders on change, so a ref is enough to remember it.
  const mapShown = useRef(false);
  if (tab === "map") mapShown.current = true;
  const mapVisible = tab === "map" && !cityPageId && !countryPageId;
  const firstRender = useRef(true);

  useEffect(() => {
    void useVisits.getState().load();
    void useTrips.getState().load();
    void useStories.getState().load();
  }, []);

  // Move focus to the content region on tab change and when a city/country
  // detail page opens or closes — both swap out <main> (skip initial mount).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [tab, cityPageId, countryPageId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // A modal/lightbox/open composer on screen consumes Escape (its own
        // handler closes it) — only an unobstructed Escape navigates back.
        // A DIRTY composer counts as an open layer; the always-open blank
        // Journal form must not swallow the Escape that navigates away.
        const dialogOpen = !!document.querySelector(
          ".modal-backdrop, .lightbox, .maplibregl-popup, .journal-composer-busy",
        );
        setShowHelp(false);
        setShowAbout(false);
        if (!dialogOpen) {
          // On a city/country page, Escape leaves the page layer (never back
          // through other pages you viewed); elsewhere it walks history.
          const ui = useUi.getState();
          if (ui.cityPageId || ui.countryPageId) ui.closePages();
          else ui.goBack();
        }
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
      // Passport & Moments moved into Places — their old shortcuts still work.
      if (e.key.toLowerCase() === "f") {
        useUi.getState().openPlaces("passport");
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "x") {
        useUi.getState().openPlaces("moments");
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

  // The phone Back gesture used to quit the whole app. Trap it: Back retraces
  // YOUR actual steps — close an open dialog, then return to the previous
  // screen you were on (tab or page, via the app's own history), one step per
  // press. In an installed (standalone) app Back never exits (use the home
  // gesture); in a browser tab a Back with no app history left is allowed
  // through so the tab can still navigate away normally.
  useEffect(() => {
    const standalone =
      (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    const arm = () => history.pushState({ pc: true }, "");
    arm();
    function onPop() {
      const ui = useUi.getState();
      const dialogOpen = !!document.querySelector(
        ".modal-backdrop, .lightbox, .maplibregl-popup, .journal-composer-busy",
      );
      if (dialogOpen) {
        // Let the open layer close via its own Escape handler.
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        arm();
        return;
      }
      // Always the LAST screen: pop the app's own navigation history.
      if (ui.goBack()) {
        arm();
        return;
      }
      // Nothing left to go back to: keep a standalone app open; let a browser tab go.
      if (standalone) arm();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLabel = TABS.find((x) => x.id === tab)?.label ?? "";

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
            <h1 className="brand-wrap">
              <button
                type="button"
                className="brand"
                title="Go to the map"
                onClick={() => setTab("map")}
              >
                Postcards
              </button>
            </h1>
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
                  aria-label="Install the app"
                  title="Install the app"
                  onClick={() => void install()}
                >
                  ⬇ <span aria-hidden>Install app</span>
                </button>
              )}
              <a
                className="topbar-about topbar-star"
                href="https://github.com/davd-gzl/Postcards"
                target="_blank"
                rel="noopener noreferrer"
                title="Star Postcards on GitHub"
                aria-label="Star Postcards on GitHub"
              >
                <span className="star-glyph" aria-hidden>
                  ⭐
                </span>
                <span>GitHub</span>
              </a>
              <button
                type="button"
                className="topbar-about"
                aria-haspopup="dialog"
                aria-label="How it works"
                title="How it works"
                onClick={() => setShowAbout(true)}
              >
                <InfoIcon />
                <span aria-hidden>How it works</span>
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
            className={"content" + (mapVisible ? " flush" : "")}
          >
            {/* The map stays MOUNTED (hidden, not unmounted) once it has been
                shown: unmounting tore down MapLibre and every tab switch back
                reloaded the whole map. Hidden it keeps its camera and tiles. */}
            {(mapShown.current || tab === "map") && (
              <div className={"map-keep" + (mapVisible ? "" : " map-keep-hidden")}>
                <Suspense fallback={<p className="muted empty">Loading map…</p>}>
                  <MapScreen active={mapVisible} />
                </Suspense>
              </div>
            )}
            {cityPageId ? (
              <CityScreen cityId={cityPageId} onBack={() => useUi.getState().closeCity()} />
            ) : countryPageId ? (
              <CountryScreen iso2={countryPageId} onBack={() => useUi.getState().closeCity()} />
            ) : (
              <>
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
