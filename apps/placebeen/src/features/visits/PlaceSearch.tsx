import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { searchPlaces } from "./search";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const focusNonce = useUi((s) => s.searchFocusNonce);

  // Focus when the "/" shortcut asks (nonce > 0 avoids grabbing focus on mount).
  useEffect(() => {
    if (focusNonce > 0) inputRef.current?.focus();
  }, [focusNonce]);

  const results = useMemo(() => searchPlaces(ref, q), [ref, q]);
  const notFound = q.trim().length >= 2 && results.length === 0;

  function pick(kind: "country" | "city", id: string, name: string, countryId: string) {
    void toggleVisit({ kind, id, name, countryId });
    if (kind === "city") {
      const c = ref.cityById(id);
      if (c) onFocusCity?.({ lon: c.lon, lat: c.lat });
    }
    setQ("");
    inputRef.current?.focus();
  }

  return (
    <div className="search">
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder="Search a city or country…"
        aria-label="Search a city or country"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="search-results"
        aria-autocomplete="list"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQ("");
        }}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {notFound
          ? `No matches for ${q.trim()}`
          : results.length > 0
            ? `${results.length} result${results.length === 1 ? "" : "s"}`
            : ""}
      </p>
      {results.length > 0 && (
        <ul className="results" id="search-results" role="listbox" aria-label="Search results">
          {results.map((r) => {
            const visited = !!findByPlace(visits, r.place);
            return (
              <li key={`${r.place.kind}:${r.place.id}`} role="option" aria-selected={false}>
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
