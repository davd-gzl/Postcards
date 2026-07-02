import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { formatDate } from "../../lib/format/format";
import { CONTINENT_COLORS } from "../../lib/reference/continents";

type View = "visited" | "countries";

/** Your visited places + a browsable checklist of every country. */
export function PlacesScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const removeVisit = useVisits((s) => s.removeVisit);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const flyTo = useUi((s) => s.flyTo);

  const [view, setView] = useState<View>("visited");
  const [filter, setFilter] = useState("");

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => a.place.name.localeCompare(b.place.name)),
    [visits],
  );

  const visitedCountryIds = useMemo(
    () => new Set(visits.filter((v) => v.place.kind === "country").map((v) => v.place.id)),
    [visits],
  );

  const countryRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const all = ref.countries;
    if (!f) return all;
    return all.filter((c) => c.name.toLowerCase().includes(f));
  }, [ref, filter]);

  function toggleCountry(iso2: string, name: string) {
    const prev = useVisits.getState().visits;
    const was = findByPlace(prev, { kind: "country", id: iso2 });
    void toggleVisit({ kind: "country", id: iso2, name, countryId: iso2 });
    showToast(was ? `Removed ${name}` : `Added ${name}`, () => setAll(prev));
  }

  function removeWithUndo(visitId: string, name: string) {
    const prev = useVisits.getState().visits;
    void removeVisit(visitId);
    showToast(`Removed ${name}`, () => setAll(prev));
  }

  return (
    <section aria-label="Your places">
      <div className="section-head">
        <h2>Places</h2>
        <div className="segmented" role="tablist" aria-label="Places view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "visited"}
            className={view === "visited" ? "seg-on" : ""}
            onClick={() => setView("visited")}
          >
            Visited ({visits.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "countries"}
            className={view === "countries" ? "seg-on" : ""}
            onClick={() => setView("countries")}
          >
            Countries
          </button>
        </div>
      </div>

      {view === "visited" && (
        <>
          {visits.length === 0 && (
            <p className="muted empty">
              Nothing yet. Add places from the map, or switch to “Countries” to check off the
              countries you've been to.
            </p>
          )}
          <ul className="city-list">
            {sortedVisits.map((v) => {
              const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
              const city = v.place.kind === "city" ? ref.cityById(v.place.id) : undefined;
              return (
                <li key={v.visitId} className="city-row">
                  <button
                    className="city-focus"
                    type="button"
                    onClick={() => (city ? flyTo(city.lon, city.lat) : undefined)}
                    aria-label={city ? `Show ${v.place.name} on the map` : v.place.name}
                  >
                    <span className="city-name">{v.place.name}</span>
                    <span className="city-sub">
                      {v.place.kind === "city" ? country : "Country"}
                      {v.date ? ` · ${formatDate(v.date)}` : ""}
                      {v.note ? ` · ${v.note}` : ""}
                    </span>
                  </button>
                  <button
                    className="link-danger"
                    type="button"
                    onClick={() => removeWithUndo(v.visitId, v.place.name)}
                    aria-label={`Remove ${v.place.name}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {view === "countries" && (
        <>
          <input
            type="search"
            className="search-input"
            placeholder="Filter countries…"
            aria-label="Filter countries"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="city-list" style={{ marginTop: 8 }}>
            {countryRows.map((c) => {
              const visited = visitedCountryIds.has(c.iso2);
              return (
                <li key={c.iso2} className="city-row">
                  <div className="city-focus" style={{ cursor: "default" }}>
                    <span className="city-name">
                      <span
                        className="legend-dot"
                        style={{
                          background: CONTINENT_COLORS[c.continent] ?? "#9aa4b2",
                          display: "inline-block",
                          marginRight: 8,
                        }}
                        aria-hidden
                      />
                      {c.name}
                    </span>
                    <span className="city-sub">{c.continent || "—"}</span>
                  </div>
                  <button
                    className={"toggle" + (visited ? " toggle-on" : "")}
                    type="button"
                    aria-pressed={visited}
                    aria-label={visited ? `Remove ${c.name}` : `Mark ${c.name} visited`}
                    onClick={() => toggleCountry(c.iso2, c.name)}
                  >
                    {visited ? "✓" : "+"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
