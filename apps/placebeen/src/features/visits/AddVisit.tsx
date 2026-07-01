import { useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { searchPlaces, type SearchResult } from "./search";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import type { PlaceRef } from "../../lib/schema/models";

export function AddVisit({ onAdded }: { onAdded?: () => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const addVisit = useVisits((s) => s.addVisit);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const results: SearchResult[] = useMemo(
    () => (selected ? [] : searchPlaces(ref, query)),
    [ref, query, selected],
  );
  const notFound = query.trim().length >= 2 && results.length === 0 && !selected;

  const alreadyVisited = selected ? findByPlace(visits, selected) : undefined;

  function choose(place: PlaceRef) {
    setSelected(place);
    const existing = findByPlace(visits, place);
    setDate(existing?.date ?? "");
    setNote(existing?.note ?? "");
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setDate("");
    setNote("");
    searchRef.current?.focus();
  }

  async function submit() {
    if (!selected) return;
    await addVisit({ place: selected, date: date || null, note: note || null });
    setJustAdded(selected.name);
    reset();
    onAdded?.();
  }

  return (
    <div className="panel">
      <h2>Add a visit</h2>

      {!selected && (
        <>
          <label htmlFor="place-search">Search a city or country</label>
          <input
            id="place-search"
            ref={searchRef}
            type="text"
            autoFocus
            placeholder="e.g. Paris, France, Seoul…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-describedby={notFound ? "not-found" : undefined}
          />
          {results.length > 0 && (
            <ul className="results" aria-label="Search results">
              {results.map((r) => {
                const visited = findByPlace(visits, r.place);
                return (
                  <li key={`${r.place.kind}:${r.place.id}`}>
                    <button type="button" onClick={() => choose(r.place)}>
                      <span>
                        {r.place.name}
                        {visited ? " ✓" : ""}
                      </span>
                      <span className="detail">{visited ? "Already visited" : r.detail}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {notFound && (
            <p className="notice" id="not-found">
              “{query}” isn’t in the loaded reference data. Place'Been never invents places — this
              would be added by contributing to the open dataset, not typed into the app. (The
              starter dataset is small; the full gazetteer is a follow-up.)
            </p>
          )}
          {justAdded && (
            <p className="notice" role="status">
              Added <strong>{justAdded}</strong>. Add another, or view it on the map.
            </p>
          )}
        </>
      )}

      {selected && (
        <div>
          <p>
            <strong>{selected.name}</strong>{" "}
            <span className="muted">
              ({selected.kind}
              {alreadyVisited ? " · already visited — this will update it" : ""})
            </span>
          </p>
          <label htmlFor="visit-date">Date (optional)</label>
          <input
            id="visit-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <label htmlFor="visit-note">Note (optional)</label>
          <textarea
            id="visit-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A memory, who you were with…"
          />
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={submit}>
              {alreadyVisited ? "Update visit" : "Add visit"}
            </button>
            <button className="btn secondary" type="button" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
