import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { searchPlaces } from "./search";
import { useVisits, findByPlace } from "../../lib/store/useVisits";

/**
 * Compact search that adds a city or country in one tap. Picking a city also
 * flies the map to it. This is the "add anything" path; browsing the map's
 * cities-in-view list is the other.
 */
export function PlaceSearch({ onFocusCity }: { onFocusCity?: (c: { lon: number; lat: number }) => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const [q, setQ] = useState("");

  const results = useMemo(() => searchPlaces(ref, q), [ref, q]);
  const notFound = q.trim().length >= 2 && results.length === 0;

  function pick(kind: "country" | "city", id: string, name: string, countryId: string) {
    void toggleVisit({ kind, id, name, countryId });
    if (kind === "city") {
      const c = ref.cityById(id);
      if (c) onFocusCity?.({ lon: c.lon, lat: c.lat });
    }
    setQ("");
  }

  return (
    <div className="search">
      <input
        type="search"
        className="search-input"
        placeholder="Search a city or country…"
        aria-label="Search a city or country"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="results" aria-label="Search results">
          {results.map((r) => {
            const visited = !!findByPlace(visits, r.place);
            return (
              <li key={`${r.place.kind}:${r.place.id}`}>
                <button
                  type="button"
                  onClick={() => pick(r.place.kind, r.place.id, r.place.name, r.place.countryId)}
                >
                  <span className="result-main">
                    <span className="result-name">{r.place.name}</span>
                    <span className="result-detail">{r.detail}</span>
                  </span>
                  <span className={"chip" + (visited ? " chip-on" : "")}>
                    {visited ? "✓ Visited" : "Add"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {notFound && (
        <p className="search-empty">
          “{q.trim()}” isn’t in the loaded data. Place'Been never invents places — missing ones are
          added by contributing to the open dataset. (The starter dataset is small.)
        </p>
      )}
    </div>
  );
}
