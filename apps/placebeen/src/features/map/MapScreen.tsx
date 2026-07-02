import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatInt } from "../../lib/format/format";
import type { Country } from "../../lib/reference/types";
import { PlaceSearch } from "../visits/PlaceSearch";
import { MapView, type MapFocus, type MapFit } from "./MapView";
import { MapLegend } from "./MapLegend";
import { citiesInView, type Bounds } from "./viewport";

const CAP = 30;

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
    const was = findByPlace(prev, place);
    void toggleVisit(place);
    showToast(was ? `Removed ${place.name}` : `Added ${place.name}`, () => setAll(prev));
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
      </div>

      <div className="map-box">
        <MapView
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
              const visited = visitedCityIds.has(c.id);
              const country = ref.countryByIso2(c.countryIso2)?.name ?? c.countryIso2;
              const selected = selectedCityId === c.id;
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
                    {selected && c.population != null && (
                      <span className="city-detail">
                        {formatInt(c.population)} people
                      </span>
                    )}
                  </button>
                  <button
                    className={"toggle" + (visited ? " toggle-on" : "")}
                    type="button"
                    aria-pressed={visited}
                    aria-label={visited ? `Remove ${c.name}` : `Mark ${c.name} visited`}
                    onClick={() =>
                      toggleWithUndo({ kind: "city", id: c.id, name: c.name, countryId: c.countryIso2 })
                    }
                  >
                    {visited ? "✓" : "+"}
                  </button>
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
