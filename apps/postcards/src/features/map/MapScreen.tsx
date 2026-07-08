import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatInt } from "../../lib/format/format";
import type { Country } from "../../lib/reference/types";
import { PlaceSearch } from "../visits/PlaceSearch";
import { StateToggles } from "../visits/StateToggles";
import { StatStrip } from "../stats/StatStrip";
import { MapView, type Basemap, type MapFocus, type MapFit } from "./MapView";
import { MapLegend } from "./MapLegend";
import { tripArcs } from "./visitedLayers";
import { citiesInView, type Bounds } from "./viewport";
import { saveAreaOffline } from "./offlineTiles";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";

const CAP = 30;
type CityFilter = "all" | "unvisited" | "visited";
const BASEMAP_KEY = "postcards-basemap";

const BASEMAP_LABEL: Record<Basemap, string> = {
  simple: "Simple map (offline)",
  osm: "Detail map (online)",
  detail: "Streets (offline)",
};

function loadBasemap(): Basemap {
  try {
    const v = localStorage.getItem(BASEMAP_KEY);
    return v === "osm" || v === "detail" ? v : "simple";
  } catch {
    return "simple";
  }
}

function persistBasemap(b: Basemap): void {
  try {
    localStorage.setItem(BASEMAP_KEY, b);
  } catch {
    /* private mode: not persisted */
  }
}

export function MapScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const mapFocus = useUi((s) => s.mapFocus);

  const allCities = useMemo(() => ref.allCities(), [ref]);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [fit, setFit] = useState<MapFit | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>(loadBasemap);
  const [hasDetail, setHasDetail] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const trips = useTrips((s) => s.trips);
  const [showTrips, setShowTrips] = useState(true);
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
        persistBasemap("simple");
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Track connectivity so the online OSM basemap can auto-fall back when offline.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
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
  // OSM stays selected when offline so tiles you've SAVED render without network;
  // the always-offline "Simple" overview is one tap away. (0..1 = download in progress.)
  const [saving, setSaving] = useState<number | null>(null);

  function switchBasemap() {
    setBasemap(nextBasemap);
    persistBasemap(nextBasemap);
  }

  async function saveArea() {
    if (!bounds || saving != null) return;
    setSaving(0);
    try {
      const res = await saveAreaOffline(bounds, bounds.zoom ?? 3, {
        onProgress: (p) => setSaving(p.total ? p.done / p.total : 1),
      });
      // Tiles are fetched no-cors, so their HTTP status is unreadable — report
      // "fetched" (what we can verify) rather than claiming a guaranteed save.
      showToast(
        res.total === 0
          ? "Nothing to save at this zoom — zoom in first."
          : `Fetched ${res.total} map tiles for this area${res.capped ? " (zoom in to save finer detail)" : ""}.`,
      );
    } catch {
      showToast("Couldn't save this area — check your connection.");
    } finally {
      setSaving(null);
    }
  }

  const inView = useMemo(() => citiesInView(allCities, bounds, Infinity), [allCities, bounds]);
  const visitedCityIds = useMemo(
    () => new Set(visits.filter((v) => v.place.kind === "city").map((v) => v.place.id)),
    [visits],
  );
  const filteredInView = useMemo(() => {
    if (cityFilter === "all") return inView;
    const want = cityFilter === "visited";
    return inView.filter((c) => visitedCityIds.has(c.id) === want);
  }, [inView, cityFilter, visitedCityIds]);
  const visible = useMemo(() => filteredInView.slice(0, CAP), [filteredInView]);
  const visitedInView = useMemo(
    () => inView.reduce((n, c) => n + (visitedCityIds.has(c.id) ? 1 : 0), 0),
    [inView, visitedCityIds],
  );

  const arcs = useMemo(() => tripArcs(trips, ref), [trips, ref]);
  const hasArcs = arcs.features.length > 0;

  // Another tab asked the map to fly somewhere (Places row → map).
  useEffect(() => {
    if (mapFocus) setFocus({ lon: mapFocus.lon, lat: mapFocus.lat, key: mapFocus.nonce });
  }, [mapFocus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  function focusCity(c: { lon: number; lat: number }) {
    setFocus((f) => ({ lon: c.lon, lat: c.lat, key: (f?.key ?? 0) + 1 }));
  }

  function toggleWithUndo(place: { kind: "country" | "city"; id: string; name: string; countryId: string }) {
    const prev = useVisits.getState().visits;
    const wasVisited = findByPlace(prev, place)?.status === "visited";
    void toggleVisit(place);
    showToast(wasVisited ? `Removed ${place.name}` : `Added ${place.name}`, () => setAll(prev));
  }

  function onCountryTap(country: Country) {
    toggleWithUndo({ kind: "country", id: country.iso2, name: country.name, countryId: country.iso2 });
  }

  const visitedCityCoords = useMemo(
    () =>
      visits
        .filter((v) => v.place.kind === "city")
        .map((v) => ref.cityById(v.place.id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [visits, ref],
  );

  function fitToMyPlaces() {
    if (!visitedCityCoords.length) return;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const c of visitedCityCoords) {
      west = Math.min(west, c.lon);
      east = Math.max(east, c.lon);
      south = Math.min(south, c.lat);
      north = Math.max(north, c.lat);
    }
    setFit((f) => ({ bounds: [[west, south], [east, north]], key: (f?.key ?? 0) + 1 }));
  }

  return (
    <div className="map-screen">
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
          onCountryTap={onCountryTap}
          viewCities={visible}
          tripArcs={showTrips ? arcs : null}
        />
        <div className="map-ctl map-ctl-left">
          {visitedCityCoords.length > 0 && (
            <button className="map-btn" type="button" onClick={fitToMyPlaces}>
              Fit to my places
            </button>
          )}
          {basemap === "osm" && online && (
            <button
              className="map-btn"
              type="button"
              onClick={saveArea}
              disabled={saving != null}
              aria-label={
                saving == null
                  ? "Save area for offline use"
                  : `Saving area, ${Math.round(saving * 100)} percent`
              }
              title="Download the current area so this map works offline"
            >
              {saving == null ? "⬇ Save area" : `Saving ${Math.round(saving * 100)}%`}
            </button>
          )}
        </div>
        <div className="map-ctl map-ctl-right">
          {hasArcs && (
            <button
              className={"map-btn" + (showTrips ? " on" : "")}
              type="button"
              aria-pressed={showTrips}
              onClick={() => setShowTrips((s) => !s)}
              title={showTrips ? "Hide trip routes" : "Show trip routes"}
            >
              {showTrips ? "✓ Trips" : "Trips"}
            </button>
          )}
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

      <MapLegend />

      <section className="view-list" aria-label="Cities in view">
        <div className="section-head">
          <h2>Cities in view</h2>
          <span className="list-head-meta muted">
            <span>{inView.length} in view</span>
            {visitedInView > 0 && <span>· {visitedInView} visited</span>}
          </span>
        </div>

        <div className="segmented list-filter" role="group" aria-label="Filter cities">
          {(["all", "unvisited", "visited"] as CityFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={cityFilter === f}
              className={cityFilter === f ? "seg-on" : ""}
              onClick={() => setCityFilter(f)}
            >
              {f === "all" ? "All" : f === "unvisited" ? "To visit" : "Visited"}
            </button>
          ))}
        </div>

        {inView.length === 0 ? (
          <p className="muted empty">
            <span className="empty-emoji" aria-hidden>
              🗺️
            </span>
            No cities of 15,000+ people in this view. Pan or zoom the map — or tap a country to mark
            the whole country visited.
          </p>
        ) : filteredInView.length === 0 ? (
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
                      setSelectedCityId(selected ? null : c.id);
                      focusCity(c);
                    }}
                  >
                    <span className="city-line">
                      <span className="flag" aria-hidden>
                        {countryFlag(c.countryIso2)}
                      </span>
                      <span className="city-name">{c.name}</span>
                      <span className="city-sub">· {country}</span>
                    </span>
                    {selected && (
                      <span className="city-detail">
                        {c.population != null ? `${formatInt(c.population)} people` : "—"}
                        {region ? ` · ${region}` : ""}
                      </span>
                    )}
                  </button>
                  <StateToggles place={place} />
                </li>
              );
            })}
          </ul>
        )}
        {filteredInView.length > CAP && (
          <p className="muted cap-note">
            Showing the {CAP} most populous of {filteredInView.length}. Zoom in for the rest.
          </p>
        )}
      </section>
    </div>
  );
}
