import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatInt } from "../../lib/format/format";
import type { Country } from "../../lib/reference/types";
import { PlaceSearch } from "../visits/PlaceSearch";
import { StateToggles } from "../visits/StateToggles";
import { StatStrip } from "../stats/StatStrip";
import { MapView, type Basemap, type MapFocus, type MapFit } from "./MapView";
import { MapLegend } from "./MapLegend";
import { citiesInView, type Bounds } from "./viewport";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";

const CAP = 30;
const BASEMAP_KEY = "placebeen-basemap";

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

  const basemapCycle: Basemap[] = hasDetail ? ["simple", "osm", "detail"] : ["simple", "osm"];
  const nextBasemap = basemapCycle[(basemapCycle.indexOf(basemap) + 1) % basemapCycle.length]!;

  function switchBasemap() {
    setBasemap(nextBasemap);
    persistBasemap(nextBasemap);
  }

  const inView = useMemo(() => citiesInView(allCities, bounds, Infinity), [allCities, bounds]);
  const visible = useMemo(() => inView.slice(0, CAP), [inView]);
  const visitedCityIds = useMemo(
    () => new Set(visits.filter((v) => v.place.kind === "city").map((v) => v.place.id)),
    [visits],
  );
  const visitedInView = useMemo(
    () => inView.reduce((n, c) => n + (visitedCityIds.has(c.id) ? 1 : 0), 0),
    [inView, visitedCityIds],
  );

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
          onBounds={setBounds}
          focus={focus}
          fit={fit}
          onCountryTap={onCountryTap}
          viewCities={visible}
        />
        {visitedCityCoords.length > 0 && (
          <button className="fit-btn" type="button" onClick={fitToMyPlaces}>
            Fit to my places
          </button>
        )}
        <button
          className="fit-btn basemap-btn"
          type="button"
          onClick={switchBasemap}
          title={`Switch basemap — next: ${BASEMAP_LABEL[nextBasemap]}`}
        >
          {BASEMAP_LABEL[nextBasemap]}
        </button>
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

        {inView.length === 0 ? (
          <p className="muted empty">
            No cities of 15,000+ people in this view. Pan or zoom the map — or tap a country to mark
            the whole country visited.
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
        {inView.length > CAP && (
          <p className="muted cap-note">
            Showing the {CAP} most populous of {inView.length}. Zoom in for the rest.
          </p>
        )}
      </section>
    </div>
  );
}
