import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { formatCompact } from "../../lib/format/format";
import { PlaceSearch } from "../visits/PlaceSearch";
import { MapView, type MapFocus } from "./MapView";
import { MapLegend } from "./MapLegend";
import { citiesInView, type Bounds } from "./viewport";

export function MapScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const toggleVisit = useVisits((s) => s.toggleVisit);

  const allCities = useMemo(() => ref.allCities(), [ref]);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const CAP = 30;
  const inView = useMemo(() => citiesInView(allCities, bounds, 100000), [allCities, bounds]);
  const visible = inView.slice(0, CAP);
  const visitedInView = useMemo(
    () => inView.filter((c) => findByPlace(visits, { kind: "city", id: c.id })).length,
    [inView, visits],
  );

  function focusCity(c: { lon: number; lat: number }) {
    setFocus((f) => ({ lon: c.lon, lat: c.lat, key: (f?.key ?? 0) + 1 }));
  }

  return (
    <div className="map-screen">
      <div className="map-top">
        <PlaceSearch onFocusCity={focusCity} />
      </div>

      <div className="map-box">
        <MapView onBounds={setBounds} focus={focus} />
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
            Pan or zoom the map to list its cities here — the most populous first. Tap a row to fly
            there; tap <span className="chip">+</span> to mark it visited.
          </p>
        ) : (
          <ul className="city-list">
            {visible.map((c) => {
              const visited = !!findByPlace(visits, { kind: "city", id: c.id });
              const country = ref.countryByIso2(c.countryIso2)?.name ?? c.countryIso2;
              return (
                <li key={c.id} className="city-row">
                  <button className="city-focus" type="button" onClick={() => focusCity(c)}>
                    <span className="city-name">{c.name}</span>
                    <span className="city-sub">{country}</span>
                  </button>
                  <span className="pop">{c.population ? formatCompact(c.population) : ""}</span>
                  <button
                    className={"toggle" + (visited ? " toggle-on" : "")}
                    type="button"
                    aria-pressed={visited}
                    aria-label={visited ? `Remove ${c.name}` : `Mark ${c.name} visited`}
                    onClick={() =>
                      void toggleVisit({
                        kind: "city",
                        id: c.id,
                        name: c.name,
                        countryId: c.countryIso2,
                      })
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
