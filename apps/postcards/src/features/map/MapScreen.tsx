import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useGazetteerGeneration } from "../../lib/reference/useGazetteer";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useSettings, type ThemeMode } from "../../lib/store/useSettings";
import { usePrefersReducedMotion } from "../../lib/hooks/usePrefersReducedMotion";
import { useOnlineStatus } from "../../lib/hooks/useOnlineStatus";
import { countryFlag, formatInt } from "../../lib/format/format";
import { StateToggles } from "../visits/StateToggles";
import { AddPlaceForm } from "../visits/AddPlaceForm";
import { GuideButton } from "../guides/GuideButton";
import { StatStrip } from "../stats/StatStrip";
import { MapView, hasSavedCamera, type Basemap, type MapFocus, type MapFit, type MapMode } from "./MapView";
import { tripArcs } from "./visitedLayers";
import { tripsInPeriod, periodLabel, dateBuckets, matchesDateFilter } from "../travel/period";
import { citiesInView, type Bounds } from "./viewport";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import type { City } from "../../lib/reference/types";
import { CityLine } from "../../ui/CityLine";
import { MoreButton } from "../../ui/MoreButton";
import { useT, type MessageKey } from "../../lib/i18n";

// Fewer rows, faster everything: the list pages in small steps, and the
// in-view working set is capped (population-presorted, so it's always the
// most relevant cities) — reactions to a toggle stay instant even at world
// zoom instead of recounting 135k rows.
const PAGE = 30;
const IN_VIEW_CAP = 2000;
const POI_LIST_CAP = 50;
const collator = new Intl.Collator(); // hoisted: per-pair localeCompare over 135k rows janks pans
type CityFilter = "all" | "unvisited" | "visited";
const BASEMAP_KEY = "postcards-basemap";
const GLOBE_KEY = "postcards-globe";
const FILTER_KEY = "postcards-city-filter";

// i18n key for each basemap's label (translated at the call site).
const BASEMAP_LABEL_KEY: Record<Basemap, MessageKey> = {
  simple: "map.basemap.simple",
  osm: "map.basemap.osm",
  detail: "map.basemap.detail",
};

// Resolve the effective dark boolean for the basemap from the explicit theme
// choice: forced dark/light win outright; "system" follows the device query.
function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

// localStorage may throw (private mode); loading then parses null → the default,
// and saving is silently skipped.
function loadPref<T>(key: string, parse: (v: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
}

function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: not persisted */
  }
}

// The detailed OpenStreetMap map is the one true basemap now (real coastlines,
// colour, street detail — and it's downloadable for offline in Settings). The
// bland vector-outline "simple" map survives only as an automatic fallback when
// OSM tiles can't load offline, so it's no longer an option here. A previously
// saved "simple" preference migrates to "osm".
function loadBasemap(): Basemap {
  return loadPref(BASEMAP_KEY, (v) => (v === "detail" ? "detail" : "osm"));
}

/**
 * The map screen stays mounted for the app's whole life (App hides it with CSS
 * instead of unmounting — tearing down MapLibre made every return to the tab a
 * full map reload). While `active` is false only the map box itself stays in
 * the DOM; the counter strip and the in-view list unrender so their text never
 * shadows the visible screen for screen readers or tests.
 */
export function MapScreen({ active = true }: { active?: boolean } = {}) {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const showToast = useToast((s) => s.show);
  const mapFocus = useUi((s) => s.mapFocus);
  const tripYear = useUi((s) => s.tripYear);
  const tripMonth = useUi((s) => s.tripMonth);
  const setTripPeriod = useUi((s) => s.setTripPeriod);
  const reducedMotion = usePrefersReducedMotion();
  // The privacy escape hatch: when off, the app uses the no-network offline map
  // only (zero outbound requests), overriding whatever detailed basemap is saved.
  const onlineMap = useSettings((s) => s.onlineMap);
  const setOnlineMap = useSettings((s) => s.setOnlineMap);
  const maxMarkers = useSettings((s) => s.maxMarkers);
  // The explicit colour-theme choice (System / Light / Dark) drives the
  // basemap's dark palette too, so it never desyncs from the UI.
  const theme = useSettings((s) => s.theme);

  // gazGen invalidates city snapshots when the full 135k-city set streams in —
  // the singleton mutates in place, so `ref` alone never re-fires these memos.
  const gazGen = useGazetteerGeneration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allCities = useMemo(() => ref.allCities(), [ref, gazGen]);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [fit, setFit] = useState<MapFit | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>(loadBasemap);
  const [hasDetail, setHasDetail] = useState(false);
  const online = useOnlineStatus();
  // The online base fell back to the offline base (offline / blocked tiles). Set
  // when it happens; drives the manual "Reconnect" prompt — never auto-switches.
  const [fellBackOffline, setFellBackOffline] = useState(false);
  // "Add your own place" seeded from the map (long-press/right-click a spot, or
  // the ＋ Add place button which seeds the current map centre).
  const [addPlaceAt, setAddPlaceAt] = useState<{ lon: number; lat: number } | null>(null);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<CityFilter>(() =>
    loadPref(FILTER_KEY, (v) => (v === "unvisited" || v === "visited" ? v : "all")),
  );
  const trips = useTrips((s) => s.trips);
  const [showTrips, setShowTrips] = useState(true);
  const [globe, setGlobe] = useState(() => loadPref(GLOBE_KEY, (v) => v === "1"));
  const [showTowns, setShowTowns] = useState(() => loadPref("postcards-towns", (v) => v === "1"));
  // ON by default: "visited countries visually distinguished" is a core map
  // promise (US2-AC2) — the layer only paints countries you've actually visited,
  // so a fresh map stays clean anyway. The Layers toggle still turns it off.
  const [showCountries, setShowCountries] = useState(() =>
    loadPref("postcards-countries", (v) => v !== "0"),
  );
  // The list always sits right of the map (desktop) / below it (mobile);
  // the slider decides how much room it gets. The axis follows the layout.
  const [wide, setWide] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(min-width: 900px)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(min-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const screenRef = useRef<HTMLDivElement>(null);

  // The SLIDER between the panes: drag it to give the list more or less room —
  // continuously, not in dock-flips. On phones it slides up/down (map height);
  // on desktop it slides left/right (list width). Arrow keys nudge it (window-
  // splitter pattern), and the chosen size persists.
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const [mapH, setMapH] = useState<number | null>(() =>
    loadPref("postcards-map-h", (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 120 ? Math.round(n) : null;
    }),
  );
  const [listW, setListW] = useState<number | null>(() =>
    loadPref("postcards-list-w", (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 260 ? Math.round(n) : null;
    }),
  );
  const dividerDrag = useRef(false);
  function onDivDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dividerDrag.current = true;
  }
  function onDivMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dividerDrag.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const box = screenRef.current?.getBoundingClientRect();
    if (!box) return;
    if (wide) {
      const raw = box.right - e.clientX;
      setListW(clamp(Math.round(raw), 260, Math.max(320, Math.round(box.width * 0.6))));
    } else {
      const mapBox = screenRef.current?.querySelector(".map-box")?.getBoundingClientRect();
      if (!mapBox) return;
      const raw = e.clientY - mapBox.top;
      // The list may be slid nearly shut — it compresses to header + rows
      // (see the @container rule) instead of clamping early.
      setMapH(clamp(Math.round(raw), 120, Math.max(180, Math.round(box.height - 140))));
    }
  }
  function onDivUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!dividerDrag.current) return;
    dividerDrag.current = false;
    if (wide && listW != null) savePref("postcards-list-w", String(listW));
    if (!wide && mapH != null) savePref("postcards-map-h", String(mapH));
  }
  function onDivKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = 24;
    if (wide && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      // Moving the divider left grows the (right-docked) list.
      const grow = e.key === "ArrowLeft" ? step : -step;
      const next = clamp((listW ?? 360) + grow, 260, 640);
      setListW(next);
      savePref("postcards-list-w", String(next));
      e.preventDefault();
    } else if (!wide && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const mapBox = screenRef.current?.querySelector(".map-box")?.getBoundingClientRect();
      const cur = mapH ?? Math.round(mapBox?.height ?? 300);
      const ceiling = Math.max(
        180,
        Math.round((screenRef.current?.getBoundingClientRect().height ?? 940) - 140),
      );
      const next = clamp(cur + (e.key === "ArrowUp" ? -step : step), 120, ceiling);
      setMapH(next);
      savePref("postcards-map-h", String(next));
      e.preventDefault();
    }
  }
  const paneVars = {
    ...(mapH != null ? { "--map-h": `${mapH}px` } : {}),
    ...(listW != null ? { "--list-w": `${listW}px` } : {}),
  } as React.CSSProperties;
  // A focusable separator is the ARIA "window splitter" pattern — it must
  // expose its position as a value (axe: aria-required-attr).
  const dividerValue = wide
    ? Math.round((clamp((listW ?? 360) - 260, 0, 380) / 380) * 100)
    : mapH != null
      ? Math.round((clamp(mapH - 120, 0, 680) / 680) * 100)
      : 50;
  const [layersOpen, setLayersOpen] = useState(false);
  const [mode, setMode] = useState<MapMode>(() =>
    loadPref("postcards-map-mode", (v) =>
      v === "cities" || v === "monuments" || v === "airports" ? v : "all",
    ),
  );
  const [dark, setDark] = useState(() => resolveDark(theme));

  // Offer the offline street basemap only when a PMTiles pack is actually
  // installed (via the device-global Offline Map Store). None is bundled.
  useEffect(() => {
    let alive = true;
    void bundledMapSource.isAvailableOffline("world-detail").then((ok) => {
      if (!alive) return;
      setHasDetail(ok);
      if (!ok && loadBasemap() === "detail") {
        setBasemap("osm");
        savePref(BASEMAP_KEY, "osm");
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the offline basemap's palette in sync with the resolved theme. A forced
  // Light/Dark choice ignores the device query; under "system" we follow
  // prefers-color-scheme live. Re-resolves whenever the theme choice changes.
  useEffect(() => {
    setDark(resolveDark(theme));
    if (typeof matchMedia === "undefined" || theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (theme !== "system") return; // forced themes ignore the device query
      setDark(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Only the detailed map (and, if a device-global streets pack is installed, the
  // offline streets map) are user choices now — no bland outline map to cycle to.
  const basemapCycle: Basemap[] = hasDetail ? ["osm", "detail"] : ["osm"];
  const nextBasemap = basemapCycle[(basemapCycle.indexOf(basemap) + 1) % basemapCycle.length]!;
  // When online maps are turned off in Settings, force the offline vector map.
  const effectiveBasemap: Basemap = onlineMap ? basemap : "simple";

  function switchBasemap() {
    setBasemap(nextBasemap);
    savePref(BASEMAP_KEY, nextBasemap);
  }


  function toggleGlobe() {
    setGlobe((on) => {
      savePref(GLOBE_KEY, !on ? "1" : "0");
      return !on;
    });
  }

  const inView = useMemo(
    () => citiesInView(allCities, bounds, IN_VIEW_CAP, true),
    [allCities, bounds],
  );
  const inViewCapped = inView.length === IN_VIEW_CAP;

  // The map's date filter IS the shared travel period's year (useUi), so a single
  // selection drives the visited markers, the country shading, the in-view list
  // AND the trip arcs together — one coherent choice, never two that can drift
  // apart. "none" = undated visits: a map-only bucket that reads as "all" for the
  // dated trip arcs (there's no undated-trip arc), so those simply clear. It is
  // deliberately NOT a persisted map pref — it's session state shared with the
  // Trips tab, exactly like the trip filter it extends, so it belongs there.
  const mapYear = tripYear; // "all" | "YYYY" | "none"
  function changeYear(y: string) {
    // Year granularity on the map; reset month (a Trips-tab-only refinement) so a
    // stale month can't survive under a freshly-picked year.
    setTripPeriod(y, "all");
  }
  // Year chips come from YOUR visited places' dates (never the 135k gazetteer),
  // mirroring the Places/Journal/Trips year filter: newest-first + a "No date"
  // bucket when some visited place is undated.
  const yearBuckets = useMemo(
    () => dateBuckets(visits.filter((v) => v.status !== "wishlist")),
    [visits],
  );

  const visitedCityIds = useMemo(
    () =>
      new Set(
        visits
          .filter((v) => v.place.kind === "city" && matchesDateFilter(v.date, mapYear))
          .map((v) => v.place.id),
      ),
    [visits, mapYear],
  );
  // The filtered list is a SNAPSHOT: it recomputes only when the viewport or the
  // filter changes — never when a visit is toggled. So under "Hide visited",
  // checking a city keeps its row until the next map move / filter change
  // instead of yanking it away mid-action.
  const [snapshot, setSnapshot] = useState<City[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [sortAZ, setSortAZ] = useState(false);
  useEffect(() => {
    const ids = visitedCityIdsNow();
    const arr =
      cityFilter === "all"
        ? inView
        : inView.filter((c) => ids.has(c.id) === (cityFilter === "visited"));
    setSnapshot(sortAZ ? [...arr].sort((a, b) => collator.compare(a.name, b.name)) : arr);
    setShown(PAGE);
    // visitedCityIds deliberately NOT a dependency — see comment above. mapYear
    // IS one: a new period re-partitions visited vs unvisited in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, cityFilter, sortAZ, mapYear]);
  function visitedCityIdsNow(): Set<string> {
    return new Set(
      useVisits
        .getState()
        .visits.filter((v) => v.place.kind === "city" && matchesDateFilter(v.date, mapYear))
        .map((v) => v.place.id),
    );
  }
  const visible = useMemo(() => snapshot.slice(0, shown), [snapshot, shown]);
  const visitedInView = useMemo(
    () => inView.reduce((n, c) => n + (visitedCityIds.has(c.id) ? 1 : 0), 0),
    [inView, visitedCityIds],
  );

  // POI lists for the non-city map modes (Monuments / Airports in view).
  const inB = (lat: number, lon: number) =>
    !!bounds &&
    lat >= bounds.south &&
    lat <= bounds.north &&
    (bounds.west <= bounds.east
      ? lon >= bounds.west && lon <= bounds.east
      : lon >= bounds.west || lon <= bounds.east);
  const poi = useMemo(() => {
    // The header shows totals over EVERYTHING in view (visited counted from
    // your records of this kind), even though the list renders at most 100.
    const visitedOf = (kind: "heritage" | "airport") =>
      new Set(
        useVisits
          .getState()
          .visits.filter(
            (v) => v.place.kind === kind && v.status !== "wishlist" && matchesDateFilter(v.date, mapYear),
          )
          .map((v) => v.place.id),
      );
    if (mode === "monuments") {
      const all = ref
        .allHeritage()
        .filter((h) => (h.lat !== 0 || h.lon !== 0) && inB(h.lat, h.lon));
      const seen = visitedOf("heritage");
      return {
        total: all.length,
        visited: all.reduce((n, h) => n + (seen.has(h.id) ? 1 : 0), 0),
        items: all.slice(0, POI_LIST_CAP).map((h) => ({
          key: h.id,
          flag: countryFlag(h.countryIso2),
          name: h.name,
          sub: ref.countryByIso2(h.countryIso2)?.name ?? h.countryIso2,
          lat: h.lat,
          lon: h.lon,
          place: { kind: "heritage" as const, id: h.id, name: h.name, countryId: h.countryIso2 },
          page: true,
          seen: seen.has(h.id),
        })),
      };
    }
    if (mode === "airports") {
      const all = ref.allAirports().filter((a) => inB(a.lat, a.lon));
      const seen = visitedOf("airport");
      return {
        total: all.length,
        visited: all.reduce((n, a) => n + (seen.has(a.id) ? 1 : 0), 0),
        items: all.slice(0, POI_LIST_CAP).map((a) => ({
          key: a.id,
          flag: "✈️",
          name: `${a.name} (${a.id})`,
          sub: ref.countryByIso2(a.countryIso2)?.name ?? a.countryIso2,
          lat: a.lat,
          lon: a.lon,
          place: { kind: "airport" as const, id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 },
          page: false,
          seen: seen.has(a.id),
        })),
      };
    }
    return null;
    // visits deliberately via getState() — the header count refreshing on a
    // check is fine to defer to the next bounds/mode change. mapYear IS a dep so
    // the "seen" counts re-derive when the period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bounds, ref, mapYear]);

  // Trip arcs honour the same shared period as the map's year filter (useUi): a
  // year narrows them to that year's dated trips; "none"/undated has no dated-
  // trip arc, so they clear. One selection, arcs + places together.
  const arcTrips = useMemo(
    () => tripsInPeriod(trips, tripYear, tripMonth),
    [trips, tripYear, tripMonth],
  );
  const arcs = useMemo(() => tripArcs(arcTrips, ref), [arcTrips, ref]);
  const hasArcs = arcs.features.length > 0;
  // Never surface the map-only "none" bucket as a period label ("No date" isn't
  // a trip period); the Trips toggle then simply shows no tag (and no arcs).
  const periodTag = tripYear === "none" ? "" : periodLabel(tripYear, tripMonth);

  // Another tab asked the map to fly somewhere (Places row → map).
  useEffect(() => {
    if (mapFocus) setFocus({ lon: mapFocus.lon, lat: mapFocus.lat, key: mapFocus.nonce });
  }, [mapFocus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  function focusCity(c: { lon: number; lat: number }) {
    setFocus((f) => ({ lon: c.lon, lat: c.lat, key: (f?.key ?? 0) + 1 }));
  }

  function changeFilter(f: CityFilter) {
    setCityFilter(f);
    savePref(FILTER_KEY, f);
  }

  // Everything of YOURS with coordinates — visited & wishlist cities, plus your
  // own custom points. This is what the first frame frames.
  const myPlaceCoords = useMemo(() => {
    const out: { lon: number; lat: number }[] = [];
    for (const v of visits) {
      if (v.place.kind === "city") {
        const c = ref.cityById(v.place.id);
        if (c) out.push({ lon: c.lon, lat: c.lat });
      } else if (v.place.kind === "custom" && v.place.lat != null && v.place.lon != null) {
        out.push({ lon: v.place.lon, lat: v.place.lat });
      }
    }
    return out;
    // gazGen: a restored visit to a small town resolves once the full set lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, ref, gazGen]);

  // First open: SNAP to your world (visited + wishlist + custom) before the
  // basemap even finishes — never a generic world view first.
  const didInitFit = useRef(false);
  useEffect(() => {
    if (didInitFit.current || hasSavedCamera() || myPlaceCoords.length === 0) return;
    didInitFit.current = true;
    fitToMyPlaces(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlaceCoords]);

  function fitToMyPlaces(instant = false) {
    if (!myPlaceCoords.length) return;
    let south = Infinity, north = -Infinity;
    for (const c of myPlaceCoords) {
      south = Math.min(south, c.lat);
      north = Math.max(north, c.lat);
    }
    // Longitude needs antimeridian care (Fiji + Samoa must not frame the whole
    // globe): the tightest frame is the complement of the LARGEST gap between
    // consecutive sorted longitudes (wrapping counts as a gap too).
    const lons = myPlaceCoords.map((c) => c.lon).sort((a, b) => a - b);
    let gapAfter = lons.length - 1;
    let gapSize = lons[0]! + 360 - lons[lons.length - 1]!;
    for (let i = 1; i < lons.length; i++) {
      const g = lons[i]! - lons[i - 1]!;
      if (g > gapSize) {
        gapSize = g;
        gapAfter = i - 1;
      }
    }
    const west = lons[(gapAfter + 1) % lons.length]!;
    let east = lons[gapAfter]!;
    if (east < west) east += 360; // the frame crosses the antimeridian
    setFit((f) => ({ bounds: [[west, south], [east, north]], key: (f?.key ?? 0) + 1, instant }));
  }

  return (
    <div
      ref={screenRef}
      style={paneVars}
      className="map-screen"
    >
      {/* Search lives in the app top bar now — this row is just the counters. */}
      {active && (
        <div className="map-top">
          <StatStrip />
        </div>
      )}

      <div className="map-box">
        <MapView
          key={effectiveBasemap}
          basemap={effectiveBasemap}
          dark={dark}
          onBounds={setBounds}
          focus={focus}
          fit={fit}
          cityFilter={cityFilter}
          tripArcs={showTrips ? arcs : null}
          globe={globe}
          mode={mode}
          showTowns={showTowns}
          showCountries={showCountries}
          maxMarkers={maxMarkers}
          year={mapYear}
          reducedMotion={reducedMotion}
          onBaseUnavailable={() => {
            if (basemap === "osm") {
              // Session-only fallback — do NOT persist. A transient outage must
              // not strand the user on the offline base forever; reconnecting (or
              // a reload) restores the online map with the saved preference intact.
              setBasemap("simple");
              setFellBackOffline(true);
              showToast(t("map.toast.offlineFallback"));
            }
          }}
          onAddHere={(c) => {
            setAddPlaceAt(c);
            setAddPlaceOpen(true);
          }}
        />
        {online && fellBackOffline && onlineMap && (
          <div className="map-reconnect" role="status">
            <span className="small">{t("map.reconnect.back")}</span>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setBasemap("osm");
                savePref(BASEMAP_KEY, "osm");
                setFellBackOffline(false);
              }}
            >
              {t("map.reconnect.button")}
            </button>
          </div>
        )}
        <div className="map-ctl map-ctl-top segmented" role="group" aria-label={t("map.modeAria")}>
          {(["all", "cities", "monuments", "airports"] as MapMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={mode === m ? "seg-on" : ""}
              onClick={() => {
                setMode(m);
                savePref("postcards-map-mode", m);
              }}
            >
              {m === "all"
                ? t("map.mode.all")
                : m === "cities"
                  ? t("map.mode.cities")
                  : m === "monuments"
                    ? `🏛 ${t("map.mode.monuments")}`
                    : `✈ ${t("map.mode.airports")}`}
            </button>
          ))}
        </div>
        <div className="map-ctl map-ctl-left">
          {/* No "+ Add place" button: add via long-press/right-click on the map
              (the "Add a place here" popup) or the search box. Keeps the controls
              uncluttered. */}
          {myPlaceCoords.length > 0 && (
            <button className="map-btn" type="button" onClick={() => fitToMyPlaces()}>
              {t("map.fitToMyPlaces")}
            </button>
          )}
        </div>
        {addPlaceOpen && (
          <div
            className="map-add-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={t("map.addDialogAria")}
            onClick={() => setAddPlaceOpen(false)}
          >
            <div className="map-add-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <h3>{t("map.addDialogTitle")}</h3>
                <button
                  className="link"
                  type="button"
                  onClick={() => setAddPlaceOpen(false)}
                  aria-label={t("common.close")}
                >
                  {t("common.close")}
                </button>
              </div>
              <AddPlaceForm
                initialName=""
                initialCoords={addPlaceAt ?? undefined}
                onDone={() => setAddPlaceOpen(false)}
              />
            </div>
          </div>
        )}
        <div className="map-ctl map-ctl-right">
          <button
            className={"map-btn" + (layersOpen ? " on" : "")}
            type="button"
            aria-expanded={layersOpen}
            aria-haspopup="true"
            title={t("map.layersTitle")}
            onClick={() => setLayersOpen((v) => !v)}
          >
            ≡ {t("map.layersButton")}
          </button>
          {layersOpen && (
            <div className="layers-panel" role="group" aria-label={t("map.layersAria")}>
              <button
                className={"map-btn" + (globe ? " on" : "")}
                type="button"
                aria-pressed={globe}
                onClick={toggleGlobe}
              >
                🌐 {t("map.layer.globe")}
              </button>
              {hasArcs && (
                <button
                  className={"map-btn" + (showTrips ? " on" : "")}
                  type="button"
                  aria-pressed={showTrips}
                  onClick={() => setShowTrips((s) => !s)}
                  title={periodTag ? t("map.layer.tripsTitle", { period: periodTag }) : undefined}
                >
                  🧵 {t("map.layer.trips")}{showTrips && periodTag ? ` · ${periodTag}` : ""}
                </button>
              )}
              <button
                className={"map-btn" + (showTowns ? " on" : "")}
                type="button"
                aria-pressed={showTowns}
                title={t("map.layer.townsTitle")}
                onClick={() => {
                  setShowTowns((v) => {
                    savePref("postcards-towns", !v ? "1" : "0");
                    return !v;
                  });
                }}
              >
                ∴ {t("map.layer.towns")}
              </button>
              <button
                className={"map-btn" + (showCountries ? " on" : "")}
                type="button"
                aria-pressed={showCountries}
                title={t("map.layer.myCountriesTitle")}
                onClick={() => {
                  setShowCountries((v) => {
                    savePref("postcards-countries", !v ? "1" : "0");
                    return !v;
                  });
                }}
              >
                🗺 {t("map.layer.myCountries")}
              </button>
              {onlineMap && basemapCycle.length > 1 && (
                <button className="map-btn" type="button" onClick={switchBasemap}>
                  ⤳ {t(BASEMAP_LABEL_KEY[nextBasemap])}
                </button>
              )}
              {!onlineMap && (
                // Explicit one-tap consent to stream OpenStreetMap tiles — the map
                // ships offline (zero egress) until the user asks for detail here.
                <button
                  className="map-btn"
                  type="button"
                  title={t("map.online.enableHint")}
                  onClick={() => {
                    setOnlineMap(true);
                    setBasemap("osm");
                    savePref(BASEMAP_KEY, "osm");
                  }}
                >
                  🌐 {t("map.online.enable")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {active && (
        <div
          className="pane-divider"
          role="separator"
          tabIndex={0}
          aria-orientation={wide ? "vertical" : "horizontal"}
          aria-valuenow={dividerValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("map.dividerAria")}
          title={t("map.dividerTitle")}
          onPointerDown={onDivDown}
          onPointerMove={onDivMove}
          onPointerUp={onDivUp}
          onPointerCancel={onDivUp}
          onKeyDown={onDivKey}
        />
      )}
      {active && (
      <section className="view-list" aria-label={t("map.list.aria")}>
        <div className="section-head">
          <h2>{mode === "monuments" ? t("map.list.headingMonuments") : mode === "airports" ? t("map.list.headingAirports") : t("map.list.headingCities")}</h2>
          <span className="list-head-meta muted">
            <span>
              {t("map.list.inView", {
                count: poi ? poi.total : formatInt(inView.length) + (inViewCapped ? "+" : ""),
              })}
            </span>
            {(poi ? poi.visited : visitedInView) > 0 && (
              <span>{t("map.list.visited", { count: poi ? poi.visited : visitedInView })}</span>
            )}
          </span>
        </div>

        {/* Date filter — one selection narrows the markers, the country shading,
            this list AND the trip arcs to a year (or the undated bucket). Shown
            in every mode (it filters the whole map), only when your visited
            places actually span more than one bucket. Mirrors Places' chips. */}
        {(yearBuckets.years.length > 1 ||
          (yearBuckets.years.length === 1 && yearBuckets.undated)) && (
          <div
            className="segmented wrap year-filter"
            role="group"
            aria-label={t("map.yearFilterAria")}
          >
            {[
              { val: "all", label: t("map.year.all") },
              ...yearBuckets.years.map((y) => ({ val: y, label: y })),
              ...(yearBuckets.undated ? [{ val: "none", label: t("map.year.noDate") }] : []),
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                aria-pressed={mapYear === val}
                className={mapYear === val ? "seg-on" : ""}
                onClick={() => changeYear(val)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {poi ? (
          poi.items.length === 0 ? (
            <p className="muted empty">{t("map.list.poiEmpty")}</p>
          ) : (
            <>
            <div className="segmented list-filter" role="group" aria-label={t("map.filterAria")}>
              {(["all", "unvisited", "visited"] as CityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={cityFilter === f}
                  className={cityFilter === f ? "seg-on" : ""}
                  onClick={() => changeFilter(f)}
                >
                  {f === "all" ? t("map.filter.all") : f === "unvisited" ? t("map.filter.hideVisited") : t("map.filter.visited")}
                </button>
              ))}
            </div>
            <ul className="city-list">
              {poi.items
                .filter((x) =>
                  cityFilter === "all" ? true : cityFilter === "visited" ? x.seen : !x.seen,
                )
                .map((x) => (
                <li key={x.key} className="city-row compact">
                  <button
                    className="city-focus"
                    type="button"
                    title={t("stats.records.showOnMap", { name: x.name })}
                    onClick={() => focusCity({ lon: x.lon, lat: x.lat })}
                  >
                    <CityLine flag={x.flag} name={x.name} sub={<>· {x.sub}</>} />
                  </button>
                  {/* The row itself only zooms the map; details live behind 📖. */}
                  {x.page && <GuideButton place={x.place} />}
                  <StateToggles place={x.place} />
                </li>
                ))}
            </ul>
            {poi.total > poi.items.length && (
              <p className="muted small">
                {t("map.poiShowing", { shown: poi.items.length, total: poi.total })}
              </p>
            )}
            </>
          )
        ) : (
        <>
        <div className="segmented list-filter" role="group" aria-label={t("map.filterCitiesAria")}>
          {(["all", "unvisited", "visited"] as CityFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={cityFilter === f}
              className={cityFilter === f ? "seg-on" : ""}
              onClick={() => changeFilter(f)}
            >
              {f === "all" ? t("map.filter.all") : f === "unvisited" ? t("map.filter.hideVisited") : t("map.filter.visited")}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={sortAZ}
            className={sortAZ ? "seg-on" : ""}
            title={sortAZ ? t("map.sortAZTitleOn") : t("map.sortAZTitleOff")}
            onClick={() => setSortAZ((v) => !v)}
          >
            {t("map.sortAZ")}
          </button>
        </div>

        {inView.length === 0 ? (
          <p className="muted empty">
            <span className="empty-emoji" aria-hidden>
              🗺️
            </span>
            {t("map.emptyNoCities")}
          </p>
        ) : snapshot.length === 0 ? (
          <p className="muted empty">
            {cityFilter === "unvisited" ? t("map.emptyAllVisited") : t("map.emptyNoVisited")}
          </p>
        ) : (
          <ul className="city-list">
            {visible.map((c) => {
              const country = ref.countryByIso2(c.countryIso2)?.name ?? c.countryIso2;
              const region = c.subdivisionId ? ref.subdivisionById(c.subdivisionId)?.name : null;
              const selected = selectedCityId === c.id;
              const place = { kind: "city" as const, id: c.id, name: c.name, countryId: c.countryIso2 };
              return (
                <li key={c.id} className={"city-row compact" + (selected ? " selected" : "")}>
                  <button
                    className="city-focus"
                    type="button"
                    aria-expanded={selected}
                    title={t("stats.records.showOnMap", { name: c.name })}
                    onClick={() => {
                      // A row click ZOOMS, always — it never yanks you off to
                      // the detail page (that's the 📖 button on the selected
                      // row). Tapping again just re-centres.
                      setSelectedCityId(c.id);
                      focusCity(c);
                    }}
                  >
                    <CityLine
                      flag={countryFlag(c.countryIso2)}
                      name={c.name}
                      sub={
                        <>
                          · {country}
                          {region ? ` - ${region}` : ""}
                        </>
                      }
                    />
                    {selected && (
                      <span className="city-detail">
                        {c.population != null
                          ? t("map.cityPeople", { count: formatInt(c.population) })
                          : t("map.populationUnknown")}
                      </span>
                    )}
                  </button>
                  {selected && <GuideButton place={place} />}
                  <StateToggles place={place} />
                </li>
              );
            })}
          </ul>
        )}
        {snapshot.length > shown && (
          <div className="list-pager">
            <span className="muted small">
              {t("map.pagerMostPopulous", {
                shown,
                total: formatInt(snapshot.length) + (inViewCapped ? "+" : ""),
              })}
            </span>
            <MoreButton onMore={() => setShown((n) => n + PAGE)}>
              {t("journal.showMore", { count: Math.min(PAGE, snapshot.length - shown) })}
            </MoreButton>
          </div>
        )}
        </>
        )}
      </section>
      )}
    </div>
  );
}
