import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { searchPlaces } from "./search";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { useToast } from "../../lib/store/useToast";
import { AddPlaceForm } from "./AddPlaceForm";
import type { PlaceRef } from "../../lib/schema/models";

/**
 * Global place search. Picking a result NAVIGATES — it flies the map to a
 * city/airport/monument or opens a country's page — and never logs anything by
 * itself (an accidental Enter used to silently mark the top match visited).
 * Marking visited is the explicit "Add" chip on the row, or Shift+Enter.
 * Fully keyboard-operable: arrows move the active option, Escape clears.
 */
export function PlaceSearch({ onFocusCity }: { onFocusCity?: (c: { lon: number; lat: number }) => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusNonce = useUi((s) => s.searchFocusNonce);

  // Focus when the "/" shortcut asks (nonce > 0 avoids grabbing focus on mount).
  useEffect(() => {
    if (focusNonce > 0) inputRef.current?.focus();
  }, [focusNonce]);

  const results = useMemo(() => searchPlaces(ref, q), [ref, q]);
  const notFound = q.trim().length >= 2 && results.length === 0;

  // Keep the active option visible as arrows move it.
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector(`#search-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /** Show the place: fly the map to it, or open the country's page. */
  function pick(place: PlaceRef) {
    if (place.kind === "country") {
      useUi.getState().openCountry(place.countryId);
    } else if (place.kind === "city") {
      const c = ref.cityById(place.id);
      if (c) onFocusCity?.({ lon: c.lon, lat: c.lat });
    } else if (place.kind === "airport") {
      const a = ref.airportById(place.id);
      if (a) onFocusCity?.({ lon: a.lon, lat: a.lat });
    } else if (place.kind === "heritage") {
      const h = ref.heritageById(place.id);
      if (h && (h.lat !== 0 || h.lon !== 0)) onFocusCity?.({ lon: h.lon, lat: h.lat });
      else useUi.getState().openCity(place.id);
    }
    setQ("");
    setActive(-1);
    inputRef.current?.focus();
  }

  /** The explicit "log it" action (chip / Shift+Enter). Countries are never
   *  logged directly — you visit a country by visiting a place inside it. */
  function toggle(place: PlaceRef) {
    if (place.kind === "country") return;
    const prev = useVisits.getState().visits;
    const wasVisited = findByPlace(prev, place)?.status === "visited";
    void toggleVisit(place);
    // Adds are silent (the chip flips to ✓ in place); only a removal — which
    // can drop photos/notes — gets a toast, and only so it can be undone.
    if (wasVisited) showToast(`Removed ${place.name}`, () => setAll(prev));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQ("");
      setActive(-1);
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      setActive((a) => (a + 1) % results.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const r = results[active >= 0 ? active : 0];
      // Enter shows the place; Shift+Enter marks it visited (keyboard parity
      // with the row's Add chip).
      if (r) (e.shiftKey ? toggle : pick)(r.place);
      e.preventDefault();
    }
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
        aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {notFound
          ? `No matches for ${q.trim()}`
          : results.length > 0
            ? `${results.length} result${results.length === 1 ? "" : "s"}`
            : ""}
      </p>
      {results.length > 0 && (
        <ul
          ref={listRef}
          className="results results-split"
          id="search-results"
          role="listbox"
          aria-label="Search results"
        >
          {results.map((r, i) => {
            const visited = findByPlace(visits, r.place)?.status === "visited";
            return (
              <li
                key={`${r.place.kind}:${r.place.id}`}
                id={`search-opt-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={"result-open" + (i === active ? " opt-active" : "")}
                  title={
                    r.place.kind === "country"
                      ? `Open ${r.place.name}`
                      : `Show ${r.place.name} on the map`
                  }
                  onClick={() => pick(r.place)}
                >
                  <span className="result-main">
                    <span className="result-name">{r.place.name}</span>
                    <span className="result-detail">{r.detail}</span>
                  </span>
                </button>
                {/* Logging is ITS OWN button — showing a place never logs it.
                    Countries have none: they're visited via places inside. */}
                {r.place.kind !== "country" && (
                  <button
                    type="button"
                    tabIndex={-1}
                    className={"chip result-add" + (visited ? " chip-on" : "")}
                    aria-label={
                      visited
                        ? `Remove ${r.place.name} from visited`
                        : `Mark ${r.place.name} visited`
                    }
                    onClick={() => toggle(r.place)}
                  >
                    {visited ? "✓ Visited" : "＋ Add"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {notFound && (
        <div className="search-empty">
          <p>“{q.trim()}” isn’t in the loaded data.</p>
          <AddPlaceForm initialName={q.trim()} onDone={() => setQ("")} />
        </div>
      )}
    </div>
  );
}
