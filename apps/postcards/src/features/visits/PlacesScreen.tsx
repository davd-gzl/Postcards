import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatDate } from "../../lib/format/format";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { StateToggles } from "./StateToggles";

type View = "visited" | "wishlist" | "countries";

/** Map coordinate to fly to (if known) and the secondary "· type · place" label for a visit. */
function placeMeta(ref: ReferenceData, v: Visit): { coord: { lon: number; lat: number } | null; sub: string } {
  const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
  if (v.place.kind === "city") {
    const c = ref.cityById(v.place.id);
    return { coord: c ? { lon: c.lon, lat: c.lat } : null, sub: country };
  }
  if (v.place.kind === "airport") {
    const a = ref.airportById(v.place.id);
    return { coord: a ? { lon: a.lon, lat: a.lat } : null, sub: `Airport · ${country}` };
  }
  return { coord: null, sub: "Country" };
}

/** Your visited places, your wish-to-go list, + a checklist of every country. */
export function PlacesScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const removeVisit = useVisits((s) => s.removeVisit);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const flyTo = useUi((s) => s.flyTo);

  const [view, setView] = useState<View>("visited");
  const [filter, setFilter] = useState("");

  const visited = useMemo(
    () =>
      visits
        .filter((v) => v.status === "visited")
        // Favorites first, then A→Z.
        .sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) || a.place.name.localeCompare(b.place.name),
        ),
    [visits],
  );
  const wishlist = useMemo(
    () =>
      visits
        .filter((v) => v.status === "wishlist")
        .sort((a, b) => a.place.name.localeCompare(b.place.name)),
    [visits],
  );

  const countryRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const all = ref.countries;
    if (!f) return all;
    return all.filter((c) => c.name.toLowerCase().includes(f));
  }, [ref, filter]);

  function removeWithUndo(visitId: string, name: string) {
    const prev = useVisits.getState().visits;
    void removeVisit(visitId);
    showToast(`Removed ${name}`, () => setAll(prev));
  }

  return (
    <section aria-label="Your places">
      <div className="section-head">
        <h2>Places</h2>
        <div className="segmented" role="group" aria-label="Places view">
          <button
            type="button"
            aria-pressed={view === "visited"}
            className={view === "visited" ? "seg-on" : ""}
            onClick={() => setView("visited")}
          >
            Visited ({visited.length})
          </button>
          <button
            type="button"
            aria-pressed={view === "wishlist"}
            className={view === "wishlist" ? "seg-on" : ""}
            onClick={() => setView("wishlist")}
          >
            Wishlist ({wishlist.length})
          </button>
          <button
            type="button"
            aria-pressed={view === "countries"}
            className={view === "countries" ? "seg-on" : ""}
            onClick={() => setView("countries")}
          >
            Countries
          </button>
        </div>
      </div>

      {view === "visited" && (
        <>
          {visited.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                🧳
              </span>
              Nothing yet. Add places from the map, or switch to “Countries” to check off the
              countries you've been to.
            </p>
          )}
          <ul className="city-list">
            {visited.map((v) => {
              const { coord, sub } = placeMeta(ref, v);
              return (
                <li key={v.visitId} className="city-row compact">
                  <button
                    className="city-focus"
                    type="button"
                    onClick={() => (coord ? flyTo(coord.lon, coord.lat) : undefined)}
                    aria-label={coord ? `Show ${v.place.name} on the map` : v.place.name}
                  >
                    <span className="city-line">
                      <span className="flag" aria-hidden>
                        {countryFlag(v.place.countryId)}
                      </span>
                      <span className="city-name">{v.place.name}</span>
                      <span className="city-sub">
                        · {sub}
                        {v.date ? ` · ${formatDate(v.date)}` : ""}
                        {v.note ? ` · ${v.note}` : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    className={"star-btn" + (v.favorite ? " star-on" : "")}
                    type="button"
                    aria-pressed={!!v.favorite}
                    aria-label={
                      v.favorite ? `Unfavorite ${v.place.name}` : `Favorite ${v.place.name}`
                    }
                    onClick={() => void toggleFavorite(v.place)}
                  >
                    {v.favorite ? "★" : "☆"}
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

      {view === "wishlist" && (
        <>
          {wishlist.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                ⚑
              </span>
              No wishes yet. Find a place and tap the ⚑ to add it to your someday list.
            </p>
          )}
          <ul className="city-list">
            {wishlist.map((v) => {
              const { coord, sub } = placeMeta(ref, v);
              return (
                <li key={v.visitId} className="city-row compact">
                  <button
                    className="city-focus"
                    type="button"
                    onClick={() => (coord ? flyTo(coord.lon, coord.lat) : undefined)}
                    aria-label={coord ? `Show ${v.place.name} on the map` : v.place.name}
                  >
                    <span className="city-line">
                      <span className="flag" aria-hidden>
                        {countryFlag(v.place.countryId)}
                      </span>
                      <span className="city-name">{v.place.name}</span>
                      <span className="city-sub">· {sub}</span>
                    </span>
                  </button>
                  <button
                    className="mini-btn"
                    type="button"
                    aria-label={`Mark ${v.place.name} visited`}
                    onClick={() => {
                      const prev = useVisits.getState().visits;
                      void toggleVisit(v.place);
                      showToast(`Added ${v.place.name}`, () => setAll(prev));
                    }}
                  >
                    ✓ Been there
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
              return (
                <li key={c.iso2} className="city-row compact dense">
                  <div className="city-focus" style={{ cursor: "default" }} title={c.continent}>
                    <span className="city-line">
                      <span className="flag" aria-hidden>
                        {countryFlag(c.iso2)}
                      </span>
                      <span className="city-name">{c.name}</span>
                    </span>
                  </div>
                  <StateToggles
                    place={{ kind: "country", id: c.iso2, name: c.name, countryId: c.iso2 }}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
