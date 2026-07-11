import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { usePrefersReducedMotion } from "../../lib/hooks/usePrefersReducedMotion";
import { countryFlag, formatInt } from "../../lib/format/format";
import { PlaceSearch } from "../visits/PlaceSearch";
import { StateToggles } from "../visits/StateToggles";
import { GuideButton } from "../guides/GuideButton";
import { StatStrip } from "../stats/StatStrip";
import { MapView, hasSavedCamera, type Basemap, type MapFocus, type MapFit, type MapMode } from "./MapView";
import { tripArcs } from "./visitedLayers";
import { tripsInPeriod, periodLabel } from "../travel/period";
import { citiesInView, type Bounds } from "./viewport";
import { saveAreaOffline } from "./offlineTiles";
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
  osm: "Detail map (online)",
  detail: "Streets (offline)",
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

function loadBasemap(): Basemap {
  return loadPref(BASEMAP_KEY, (v) => (v === "osm" || v === "detail" ? v : "simple"));
}

export function MapScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const showToast = useToast((s) => s.show);
  const mapFocus = useUi((s) => s.mapFocus);
  const tripYear = useUi((s) => s.tripYear);
  const tripMonth = useUi((s) => s.tripMonth);
  const reducedMotion = usePrefersReducedMotion();

  const allCities = useMemo(() => ref.allCities(), [ref]);
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
  const [listTall, setListTall] = useState(false);
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
        setBasemap("simple");
        savePref(BASEMAP_KEY, "simple");
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

  const basemapCycle: Basemap[] = hasDetail ? ["simple", "osm", "detail"] : ["simple", "osm"];
  const nextBasemap = basemapCycle[(basemapCycle.indexOf(basemap) + 1) % basemapCycle.length]!;

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
          flag: "🏛️",
          name: h.name,
          sub: ref.countryByIso2(h.countryIso2)?.name ?? h.countryIso2,
          lat: h.lat,
          lon: h.lon,
          place: { kind: "heritage" as const, id: h.id, name: h.name, countryId: h.countryIso2 },
          page: true,
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
        })),
      };
    }
    return null;
    // visits deliberately via getState() — the header count refreshing on a
    // check is fine to defer to the next bounds/mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bounds, ref]);

  // One-tap offline: fetch the tiles for the CURRENT view (finer control and
  // whole regions live in Settings → Offline maps).
  const [saving, setSaving] = useState<number | null>(null);
  async function saveThisView() {
    if (!bounds || saving != null) return;
    setSaving(0);
    try {
      const res = await saveAreaOffline(bounds, bounds.zoom ?? 3, {
        onProgress: (p) => setSaving(p.total ? p.done / p.total : 1),
      });
      // saveAreaOffline never throws — report failures/caps honestly instead
      // of claiming success when every tile fetch failed.
      showToast(
        res.total === 0
          ? "Nothing to save at this zoom — zoom in first."
          : res.saved === 0
            ? "Couldn't save this view — check your connection and try again."
            : `Saved ${res.saved} map tiles for offline use.` +
              (res.failed > 0 ? ` ${res.failed} failed — save again for the rest.` : "") +
              (res.capped ? " The view was large, so only part fit — zoom in and save areas you need." : ""),
      );
    } catch {
      showToast("Couldn't save this view — check your connection.");
    } finally {
      setSaving(null);
    }
  }

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

  const visitedCityCoords = useMemo(
    () =>
      visits
        .filter((v) => v.place.kind === "city")
        .map((v) => ref.cityById(v.place.id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [visits, ref],
  );

  // First open: show YOUR world (visited + wishlist), not a generic world view.
  const didInitFit = useRef(false);
  useEffect(() => {
    if (didInitFit.current || hasSavedCamera() || visitedCityCoords.length === 0) return;
    didInitFit.current = true;
    fitToMyPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedCityCoords]);

  function fitToMyPlaces() {
    if (!visitedCityCoords.length) return;
    let south = Infinity, north = -Infinity;
    for (const c of visitedCityCoords) {
      south = Math.min(south, c.lat);
      north = Math.max(north, c.lat);
    }
    // Longitude needs antimeridian care (Fiji + Samoa must not frame the whole
    // globe): the tightest frame is the complement of the LARGEST gap between
    // consecutive sorted longitudes (wrapping counts as a gap too).
    const lons = visitedCityCoords.map((c) => c.lon).sort((a, b) => a - b);
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
    setFit((f) => ({ bounds: [[west, south], [east, north]], key: (f?.key ?? 0) + 1 }));
  }

  return (
    <div className={"map-screen" + (listTall ? " list-tall" : "")}>
      <div className="map-top">
        <PlaceSearch onFocusCity={focusCity} />
        <StatStrip />
      </div>

      <div className="map-box">
        <MapView
          key={basemap}
          basemap={basemap}
          dark={dark}
          onBounds={setBounds}
          focus={focus}
          fit={fit}
          viewCities={visible}
          tripArcs={showTrips ? arcs : null}
          globe={globe}
          mode={mode}
          showTowns={showTowns}
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
          {visitedCityCoords.length > 0 && (
            <button className="map-btn" type="button" onClick={fitToMyPlaces}>
              Fit to my places
            </button>
          )}
          {basemap === "osm" && (
            <button
              className="map-btn"
              type="button"
              disabled={saving != null}
              onClick={() => void saveThisView()}
              title="Keep the detailed map of this view available offline (whole regions: Settings → Offline maps)"
            >
              {saving == null ? "⬇ Offline" : `${Math.round(saving * 100)}%`}
            </button>
          )}
        </div>
        <div className="map-ctl map-ctl-right">
          <button
            className={"map-btn" + (globe ? " on" : "")}
            type="button"
            aria-pressed={globe}
            onClick={toggleGlobe}
            title={globe ? "Switch to the flat map" : "Switch to the 3D globe"}
          >
            {globe ? "🌐 Globe" : "🗺 Globe"}
          </button>
          {hasArcs && (
            <button
              className={"map-btn" + (showTrips ? " on" : "")}
              type="button"
              aria-pressed={showTrips}
              onClick={() => setShowTrips((s) => !s)}
              title={
                (showTrips ? "Hide trip routes" : "Show trip routes") +
                (periodTag ? ` (showing ${periodTag} — change on the Trips tab)` : "")
              }
            >
              {showTrips ? `✓ Trips${periodTag ? ` · ${periodTag}` : ""}` : "Trips"}
            </button>
          )}
          <button
            className={"map-btn" + (showTowns ? " on" : "")}
            type="button"
            aria-pressed={showTowns}
            title={showTowns ? "Hide the every-town dot field" : "Show a dot for every town on earth"}
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
            className="map-btn"
            type="button"
            onClick={switchBasemap}
            title={`Switch basemap — next: ${BASEMAP_LABEL[nextBasemap]}`}
          >
            {BASEMAP_LABEL[nextBasemap]}
          </button>
        </div>
      </div>

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
            <ul className="city-list">
              {poi.items.map((x) => (
                <li key={x.key} className="city-row compact">
                  <button
                    className="city-focus"
                    type="button"
                    onClick={() =>
                      x.page ? useUi.getState().openCity(x.place.id) : focusCity({ lon: x.lon, lat: x.lat })
                    }
                  >
                    <CityLine flag={x.flag} name={x.name} sub={<>· {x.sub}</>} />
                  </button>
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
          <label className="sort-label">
            <span className="sr-only">Sort cities</span>
            <select
              className="sort-select"
              value={sortAZ ? "az" : "pop"}
              onChange={(e) => setSortAZ(e.target.value === "az")}
            >
              <option value="pop">Most people</option>
              <option value="az">A–Z</option>
            </select>
          </label>
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
              : "No visited cities in this view yet. Switch to “All” or “To visit”."}
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
                    onClick={() => {
                      if (selected) {
                        useUi.getState().openCity(c.id);
                        return;
                      }
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
    </div>
  );
}
