import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useGazetteerGeneration } from "../../lib/reference/useGazetteer";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useSettings } from "../../lib/store/useSettings";
import { usePrefersReducedMotion } from "../../lib/hooks/usePrefersReducedMotion";
import { countryFlag, formatInt } from "../../lib/format/format";
import { StateToggles } from "../visits/StateToggles";
import { GuideButton } from "../guides/GuideButton";
import { StatStrip } from "../stats/StatStrip";
import { MapView, hasSavedCamera, type Basemap, type MapFocus, type MapFit, type MapMode } from "./MapView";
import { tripArcs } from "./visitedLayers";
import { tripsInPeriod, periodLabel } from "../travel/period";
import { citiesInView, type Bounds } from "./viewport";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import type { City } from "../../lib/reference/types";
import { CityLine } from "../../ui/CityLine";

const PAGE = 100;
const collator = new Intl.Collator(); // hoisted: per-pair localeCompare over 135k rows janks pans
type CityFilter = "all" | "unvisited" | "visited";
const BASEMAP_KEY = "postcards-basemap";
const GLOBE_KEY = "postcards-globe";
const FILTER_KEY = "postcards-city-filter";

const BASEMAP_LABEL: Record<Basemap, string> = {
  simple: "Simple map (offline)",
  osm: "Detailed map",
  detail: "Offline streets",
};

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
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const showToast = useToast((s) => s.show);
  const mapFocus = useUi((s) => s.mapFocus);
  const tripYear = useUi((s) => s.tripYear);
  const tripMonth = useUi((s) => s.tripMonth);
  const reducedMotion = usePrefersReducedMotion();
  // The privacy escape hatch: when off, the app uses the no-network offline map
  // only (zero outbound requests), overriding whatever detailed basemap is saved.
  const onlineMap = useSettings((s) => s.onlineMap);
  const maxMarkers = useSettings((s) => s.maxMarkers);

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
  const [cityFilter, setCityFilter] = useState<CityFilter>(() =>
    loadPref(FILTER_KEY, (v) => (v === "unvisited" || v === "visited" ? v : "all")),
  );
  const trips = useTrips((s) => s.trips);
  const [showTrips, setShowTrips] = useState(true);
  const [globe, setGlobe] = useState(() => loadPref(GLOBE_KEY, (v) => v === "1"));
  const [showTowns, setShowTowns] = useState(() => loadPref("postcards-towns", (v) => v === "1"));
  const [showCountries, setShowCountries] = useState(() =>
    loadPref("postcards-countries", (v) => v === "1"),
  );
  const [listTall, setListTall] = useState(false);
  // Where the list docks relative to the map: "end" = right (desktop) / below
  // (mobile), "start" = left / above. The list is never hidden — the old
  // "Bigger map" button just removed it, which read as losing your data.
  const [listSide, setListSide] = useState<"start" | "end">(() =>
    loadPref("postcards-list-side", (v) => (v === "start" ? "start" : "end")),
  );
  // Desktop docks the list sideways, mobile stacks it — the move button's
  // label follows the axis it actually moves along.
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
  function setSideTo(next: "start" | "end") {
    setListSide((s) => {
      if (s === next) return s;
      savePref("postcards-list-side", next);
      return next;
    });
  }
  // The list moves by GRABBING it: drag its ⠿ handle across the screen's
  // midline and the panel re-docks live (left/right on desktop, above/below on
  // mobile). Tapping or pressing Enter on the handle flips it too, so the
  // action stays keyboard- and single-tap-operable.
  const screenRef = useRef<HTMLDivElement>(null);
  const dragMoved = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  function onGrabDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
  }
  function onGrabMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStart.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (
      Math.abs(e.clientX - dragStart.current.x) > 6 ||
      Math.abs(e.clientY - dragStart.current.y) > 6
    ) {
      dragMoved.current = true;
    }
    if (!dragMoved.current) return;
    const box = screenRef.current?.getBoundingClientRect();
    if (!box) return;
    const firstHalf = wide
      ? e.clientX < box.left + box.width / 2
      : e.clientY < box.top + box.height / 2;
    setSideTo(firstHalf ? "start" : "end");
  }
  function onGrabUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
  }
  function onGrabClick() {
    // A real drag already placed the panel — don't flip it back on release.
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    setSideTo(listSide === "end" ? "start" : "end");
  }
  const [layersOpen, setLayersOpen] = useState(false);
  const [mode, setMode] = useState<MapMode>(() =>
    loadPref("postcards-map-mode", (v) =>
      v === "cities" || v === "monuments" || v === "airports" ? v : "all",
    ),
  );
  const [dark, setDark] = useState(() =>
    typeof matchMedia === "undefined" ? false : matchMedia("(prefers-color-scheme: dark)").matches,
  );

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

  // Follow the device light/dark theme so the offline basemap matches the UI.
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
    () => citiesInView(allCities, bounds, Infinity, true),
    [allCities, bounds],
  );
  const visitedCityIds = useMemo(
    () => new Set(visits.filter((v) => v.place.kind === "city").map((v) => v.place.id)),
    [visits],
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
    // visitedCityIds deliberately NOT a dependency — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, cityFilter, sortAZ]);
  function visitedCityIdsNow(): Set<string> {
    return new Set(
      useVisits
        .getState()
        .visits.filter((v) => v.place.kind === "city")
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
          .visits.filter((v) => v.place.kind === kind && v.status !== "wishlist")
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
        items: all.slice(0, 100).map((h) => ({
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
        items: all.slice(0, 100).map((a) => ({
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
    // check is fine to defer to the next bounds/mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bounds, ref]);

  // Trip arcs honour the Travel-log time filter (shared via useUi).
  const arcTrips = useMemo(
    () => tripsInPeriod(trips, tripYear, tripMonth),
    [trips, tripYear, tripMonth],
  );
  const arcs = useMemo(() => tripArcs(arcTrips, ref), [arcTrips, ref]);
  const hasArcs = arcs.features.length > 0;
  const periodTag = periodLabel(tripYear, tripMonth);

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
      className={
        "map-screen" + (listTall ? " list-tall" : "") + (listSide === "start" ? " list-first" : "")
      }
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
          viewCities={visible}
          tripArcs={showTrips ? arcs : null}
          globe={globe}
          mode={mode}
          showTowns={showTowns}
          showCountries={showCountries}
          maxMarkers={maxMarkers}
          reducedMotion={reducedMotion}
          onBaseUnavailable={() => {
            if (basemap === "osm") {
              setBasemap("simple");
              savePref(BASEMAP_KEY, "simple");
              showToast("Online map unavailable — showing the offline map.");
            }
          }}
        />
        <div className="map-ctl map-ctl-top segmented" role="group" aria-label="Map mode">
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
              {m === "all" ? "All" : m === "cities" ? "Cities" : m === "monuments" ? "🏛 Monuments" : "✈ Airports"}
            </button>
          ))}
        </div>
        <div className="map-ctl map-ctl-left">
          {myPlaceCoords.length > 0 && (
            <button className="map-btn" type="button" onClick={() => fitToMyPlaces()}>
              Fit to my places
            </button>
          )}
        </div>
        <div className="map-ctl map-ctl-right">
          <button
            className={"map-btn" + (layersOpen ? " on" : "")}
            type="button"
            aria-expanded={layersOpen}
            aria-haspopup="true"
            title="Map layers & view options"
            onClick={() => setLayersOpen((v) => !v)}
          >
            ≡ Layers
          </button>
          {layersOpen && (
            <div className="layers-panel" role="group" aria-label="Map layers">
              <button
                className={"map-btn" + (globe ? " on" : "")}
                type="button"
                aria-pressed={globe}
                onClick={toggleGlobe}
              >
                🌐 Globe
              </button>
              {hasArcs && (
                <button
                  className={"map-btn" + (showTrips ? " on" : "")}
                  type="button"
                  aria-pressed={showTrips}
                  onClick={() => setShowTrips((s) => !s)}
                  title={periodTag ? `Showing ${periodTag}; change on the Trips tab` : undefined}
                >
                  🧵 Trips{showTrips && periodTag ? ` · ${periodTag}` : ""}
                </button>
              )}
              <button
                className={"map-btn" + (showTowns ? " on" : "")}
                type="button"
                aria-pressed={showTowns}
                title="A dot for every town on earth"
                onClick={() => {
                  setShowTowns((v) => {
                    savePref("postcards-towns", !v ? "1" : "0");
                    return !v;
                  });
                }}
              >
                ∴ Towns
              </button>
              <button
                className={"map-btn" + (showCountries ? " on" : "")}
                type="button"
                aria-pressed={showCountries}
                title="Shade the countries you've visited"
                onClick={() => {
                  setShowCountries((v) => {
                    savePref("postcards-countries", !v ? "1" : "0");
                    return !v;
                  });
                }}
              >
                🗺 My countries
              </button>
              {onlineMap && basemapCycle.length > 1 && (
                <button className="map-btn" type="button" onClick={switchBasemap}>
                  ⤳ {BASEMAP_LABEL[nextBasemap]}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {active && (
      <section className="view-list" aria-label="Cities in view">
        <div className="section-head">
          <h2>{mode === "monuments" ? "Monuments in view" : mode === "airports" ? "Airports in view" : "Cities in view"}</h2>
          <button
            className="mini-btn list-expand"
            type="button"
            aria-pressed={listTall}
            title={listTall ? "Show the map again" : "Expand the list over the map"}
            onClick={() => setListTall((v) => !v)}
          >
            {listTall ? "▼ Map" : "▲ List"}
          </button>
          <button
            className="list-grab"
            type="button"
            aria-label={
              wide
                ? "Move the list to the other side of the map (drag or press Enter)"
                : "Move the list above or below the map (drag or press Enter)"
            }
            title={wide ? "Drag to dock the list left or right" : "Drag to dock the list above or below"}
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
            onClick={onGrabClick}
          >
            ⠿
          </button>
          <span className="list-head-meta muted">
            <span>{poi ? poi.total : inView.length} in view</span>
            {(poi ? poi.visited : visitedInView) > 0 && (
              <span>· {poi ? poi.visited : visitedInView} visited</span>
            )}
          </span>
        </div>

        {poi ? (
          poi.items.length === 0 ? (
            <p className="muted empty">Nothing in this view — pan or zoom the map.</p>
          ) : (
            <>
            <div className="segmented list-filter" role="group" aria-label="Filter">
              {(["all", "unvisited", "visited"] as CityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={cityFilter === f}
                  className={cityFilter === f ? "seg-on" : ""}
                  onClick={() => changeFilter(f)}
                >
                  {f === "all" ? "All" : f === "unvisited" ? "Hide visited" : "Visited"}
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
                    title={`Show ${x.name} on the map`}
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
                Showing {poi.items.length} of {poi.total} — zoom in to narrow the list.
              </p>
            )}
            </>
          )
        ) : (
        <>
        <div className="segmented list-filter" role="group" aria-label="Filter cities">
          {(["all", "unvisited", "visited"] as CityFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={cityFilter === f}
              className={cityFilter === f ? "seg-on" : ""}
              onClick={() => changeFilter(f)}
            >
              {f === "all" ? "All" : f === "unvisited" ? "Hide visited" : "Visited"}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={sortAZ}
            className={sortAZ ? "seg-on" : ""}
            title={sortAZ ? "Sorted A to Z; tap for most people first" : "Sorted by most people; tap for A to Z"}
            onClick={() => setSortAZ((v) => !v)}
          >
            A–Z
          </button>
        </div>

        {inView.length === 0 ? (
          <p className="muted empty">
            <span className="empty-emoji" aria-hidden>
              🗺️
            </span>
            No cities or towns in this view. Pan or zoom the map, search above, or add a missing
            place from the search box.
          </p>
        ) : snapshot.length === 0 ? (
          <p className="muted empty">
            {cityFilter === "unvisited"
              ? "You've been to every city in view. Pan somewhere new, or switch to “All”."
              : "No visited cities in this view yet. Switch to “All”, or check off a city to see it here."}
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
                    title={`Show ${c.name} on the map`}
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
                        {c.population != null ? `${formatInt(c.population)} people` : "population unknown"}
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
              Showing the {shown} most populous of {formatInt(snapshot.length)}
            </span>
            <button className="mini-btn" type="button" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, snapshot.length - shown)} more
            </button>
          </div>
        )}
        </>
        )}
      </section>
      )}
    </div>
  );
}
