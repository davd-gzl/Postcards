import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useSettings } from "../../lib/store/useSettings";
import { countryFlag, formatDate } from "../../lib/format/format";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { inScope } from "../../lib/reference/scope";
import { CityLine } from "../../ui/CityLine";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { PhotoGallery } from "./PhotoGallery";
import { StateToggles } from "./StateToggles";
import { GuideButton } from "../guides/GuideButton";

type View = "visited" | "wishlist" | "countries" | "monuments";

const MONUMENT_CAP = 80;

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
  if (v.place.kind === "heritage") {
    const h = ref.heritageById(v.place.id);
    const coord = h && (h.lat !== 0 || h.lon !== 0) ? { lon: h.lon, lat: h.lat } : null;
    return { coord, sub: `Monument · ${country}` };
  }
  return { coord: null, sub: "Country" };
}

/** One visited or wishlist row — visited adds details, photos and the favorite star. */
function VisitRow({ v, wishlist }: { v: Visit; wishlist?: boolean }) {
  const ref = useMemo(() => getReferenceData(), []);
  const removeVisit = useVisits((s) => s.removeVisit);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const flyTo = useUi((s) => s.flyTo);
  const { coord, sub } = placeMeta(ref, v);

  function removeWithUndo() {
    const prev = useVisits.getState().visits;
    void removeVisit(v.visitId);
    showToast(`Removed ${v.place.name}`, () => setAll(prev));
  }

  return (
    <li className="city-row compact">
      <button
        className="city-focus"
        type="button"
        onClick={() =>
          v.place.kind === "country" || v.place.kind === "airport"
            ? coord && flyTo(coord.lon, coord.lat)
            : useUi.getState().openCity(v.place.id)
        }
        aria-label={`Open ${v.place.name}`}
      >
        <CityLine
          flag={countryFlag(v.place.countryId)}
          name={v.place.name}
          sub={
            wishlist ? (
              <>· {sub}</>
            ) : (
              <>
                · {sub}
                {v.date ? ` · ${formatDate(v.date)}` : ""}
                {v.note ? ` · ${v.note}` : ""}
              </>
            )
          }
        />
      </button>
      <GuideButton place={v.place} />
      {!wishlist && (
        <PhotoGallery visitId={v.visitId} photos={v.photos ?? []} placeName={v.place.name} />
      )}
      {!wishlist && (
        <button
          className={"star-btn" + (v.favorite ? " star-on" : "")}
          type="button"
          aria-pressed={!!v.favorite}
          aria-label={v.favorite ? `Unfavorite ${v.place.name}` : `Favorite ${v.place.name}`}
          onClick={() => void toggleFavorite(v.place)}
        >
          {v.favorite ? "★" : "☆"}
        </button>
      )}
      {wishlist && (
        <button
          className="mini-btn"
          type="button"
          aria-label={`Mark ${v.place.name} visited`}
          onClick={() => void toggleVisit(v.place)}
        >
          ✓ Been there
        </button>
      )}
      <button
        className="link-danger"
        type="button"
        onClick={removeWithUndo}
        aria-label={`Remove ${v.place.name}`}
      >
        Remove
      </button>
    </li>
  );
}

/** Your visited places, your wish-to-go list, monuments, + a checklist of every country. */
export function PlacesScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const scope = useSettings((s) => s.countryScope);
  const [view, setView] = useState<View>("visited");
  const [favOnly, setFavOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();

  // Another screen (the map's counter strip) asked for a specific view.
  const request = useUi((s) => s.placesViewRequest);
  useEffect(() => {
    if (!request) return;
    if (request.view === "favorites") {
      setView("visited");
      setFavOnly(true);
    } else {
      setView(request.view);
      setFavOnly(false);
    }
    setFilter("");
  }, [request?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const heritageAvailable = useMemo(() => ref.allHeritage().length > 0, [ref]);

  const visited = useMemo(
    () =>
      visits
        .filter((v) => v.status === "visited" && (!favOnly || v.favorite))
        .sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) || a.place.name.localeCompare(b.place.name),
        ),
    [visits, favOnly],
  );
  const wishlist = useMemo(
    () =>
      visits
        .filter((v) => v.status === "wishlist")
        .sort((a, b) => a.place.name.localeCompare(b.place.name)),
    [visits],
  );

  // Visited places grouped for the Countries checklist: how many sub-places
  // (cities/airports/monuments) sit in each country, and which countries carry an
  // explicit country record. A country counts as visited if EITHER is true — so a
  // country is "visited" simply by visiting a city in it (no per-country record).
  const countryVisited = useMemo(() => {
    const sub = new Map<string, number>();
    const explicit = new Set<string>();
    for (const v of visits) {
      if (v.status === "wishlist") continue;
      if (v.place.kind === "country") explicit.add(v.place.countryId);
      else sub.set(v.place.countryId, (sub.get(v.place.countryId) ?? 0) + 1);
    }
    return { sub, explicit };
  }, [visits]);

  const filterVisits = (list: Visit[]) =>
    !q ? list : list.filter((v) => v.place.name.toLowerCase().includes(q));

  const countryRows = useMemo(() => {
    const all = ref.countries.filter((c) => inScope(c.sovereignty, scope));
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [ref, q, scope]);

  const monuments = useMemo(() => {
    // A search keeps the ranker's best-match-first order; only the full
    // unfiltered list reads better alphabetically.
    if (q) return ref.searchHeritage(q, 200);
    return [...ref.allHeritage()].sort((a, b) => a.name.localeCompare(b.name));
  }, [ref, q]);

  const TABS: { id: View; label: string }[] = [
    { id: "visited", label: favOnly ? `★ Favorites (${visited.length})` : `Visited (${visited.length})` },
    { id: "wishlist", label: `Wishlist (${wishlist.length})` },
    { id: "monuments", label: "Monuments" },
    { id: "countries", label: "Countries" },
  ];

  return (
    <section aria-label="Your places">
      <div className="section-head">
        <h2>Places</h2>
        <div className="segmented wrap" role="group" aria-label="Places view">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={view === t.id}
              className={view === t.id ? "seg-on" : ""}
              onClick={() => {
                setView(t.id);
                setFavOnly(false);
                setFilter("");
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={favOnly}
            className={favOnly ? "seg-on" : ""}
            title="Only your favorites"
            onClick={() => {
              setView("visited");
              setFavOnly((f) => !f);
            }}
          >
            ★
          </button>
        </div>
      </div>

      {(view === "visited" || view === "wishlist" || view === "monuments") &&
        (view !== "visited" || visited.length > 0) &&
        (view !== "wishlist" || wishlist.length > 0) &&
        (view !== "monuments" || heritageAvailable) && (
          <input
            type="search"
            className="search-input places-filter"
            placeholder={view === "monuments" ? "Search monuments…" : "Filter your places…"}
            aria-label={view === "monuments" ? "Search monuments" : "Filter your places"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}

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
            {filterVisits(visited).map((v) => (
              <VisitRow key={v.visitId} v={v} />
            ))}
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
            {filterVisits(wishlist).map((v) => (
              <VisitRow key={v.visitId} v={v} wishlist />
            ))}
          </ul>
        </>
      )}

      {view === "monuments" && (
        <>
          {!heritageAvailable ? (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                🏛️
              </span>
              The monuments dataset isn't loaded in this build. Run{" "}
              <code>scripts/build-heritage.mjs</code> to add the full UNESCO World Heritage list.
            </p>
          ) : (
            <>
              <p className="muted small">
                UNESCO World Heritage Sites — mark the ones you've seen. They count toward each
                country's coverage in Stats.
              </p>
              <ul className="city-list">
                {monuments.slice(0, MONUMENT_CAP).map((h) => {
                  const country = ref.countryByIso2(h.countryIso2)?.name ?? h.countryIso2;
                  const place = {
                    kind: "heritage" as const,
                    id: h.id,
                    name: h.name,
                    countryId: h.countryIso2,
                  };
                  return (
                    <li key={h.id} className="city-row compact">
                      <button
                        className="city-focus"
                        type="button"
                        onClick={() => useUi.getState().openCity(h.id)}
                        aria-label={`Open ${h.name}`}
                      >
                        <CityLine flag={countryFlag(h.countryIso2)} name={h.name} sub={<>· {country}</>} />
                      </button>
                      <GuideButton place={place} />
                      <StateToggles place={place} />
                    </li>
                  );
                })}
              </ul>
              {monuments.length > MONUMENT_CAP && (
                <p className="muted cap-note">
                  Showing {MONUMENT_CAP} of {monuments.length}. Search to narrow the list.
                </p>
              )}
            </>
          )}
        </>
      )}

      {view === "countries" && (
        <>
          <div className="countries-head">
            <ScopeToggle />
            <span className="muted small">{countryRows.length} shown</span>
          </div>
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
              const subCount = countryVisited.sub.get(c.iso2) ?? 0;
              const explicit = countryVisited.explicit.has(c.iso2);
              const isVisited = subCount > 0 || explicit;
              const place = { kind: "country" as const, id: c.iso2, name: c.name, countryId: c.iso2 };
              return (
                <li key={c.iso2} className="city-row compact dense">
                  <button
                    className="city-focus"
                    type="button"
                    title={`Open ${c.name}`}
                    onClick={() => useUi.getState().openCountry(c.iso2)}
                  >
                    <CityLine
                      flag={countryFlag(c.iso2)}
                      name={c.name}
                      sub={
                        isVisited && subCount > 0 ? (
                          <>
                            · via {subCount} place{subCount === 1 ? "" : "s"}
                          </>
                        ) : undefined
                      }
                    />
                  </button>
                  {isVisited && subCount > 0 && (
                    // Visited through its cities/monuments — already counted; the
                    // chip says so, and the toggles keep ⚑/★ reachable.
                    <span className="chip chip-on" aria-label={`${c.name} visited`}>
                      ✓ Visited
                    </span>
                  )}
                  <StateToggles place={place} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
